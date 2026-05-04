package com.decisionmesh.persistence.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * WebhookEventEntity — persists every incoming Stripe and Razorpay webhook.
 *
 * BillingResource webhook handlers must call WebhookEventEntity.log() on
 * each incoming event so the admin webhook log is populated.
 *
 * DB table: webhook_events
 *
 * SQL migration (add to next Flyway version):
 *
 *   CREATE TABLE webhook_events (
 *       id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *       gateway      VARCHAR(20) NOT NULL,          -- 'stripe' | 'razorpay'
 *       event_type   VARCHAR(100) NOT NULL,          -- e.g. 'invoice.payment_succeeded'
 *       payload      TEXT,                           -- raw JSON body
 *       status       VARCHAR(20) NOT NULL DEFAULT 'received', -- received | processed | failed
 *       error        TEXT,                           -- error message if status=failed
 *       org_id       UUID,                           -- resolved org (null if unresolvable)
 *       received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *       processed_at TIMESTAMPTZ
 *   );
 *
 *   CREATE INDEX idx_webhook_events_gateway    ON webhook_events(gateway);
 *   CREATE INDEX idx_webhook_events_status     ON webhook_events(status);
 *   CREATE INDEX idx_webhook_events_received   ON webhook_events(received_at DESC);
 *   CREATE INDEX idx_webhook_events_org_id     ON webhook_events(org_id);
 */
@Entity
@Table(name = "webhook_events")
public class WebhookEventEntity extends PanacheEntityBase {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    public UUID id;

    /** 'stripe' | 'razorpay' */
    @Column(name = "gateway", nullable = false, length = 20)
    public String gateway;

    /** e.g. 'invoice.payment_succeeded', 'payment.captured' */
    @Column(name = "event_type", nullable = false, length = 100)
    public String eventType;

    /** Raw JSON payload from gateway */
    @Column(name = "payload", columnDefinition = "TEXT")
    public String payload;

    /** received | processed | failed */
    @Column(name = "status", nullable = false, length = 20)
    public String status = "received";

    /** Error detail if status = 'failed' */
    @Column(name = "error", columnDefinition = "TEXT")
    public String error;

    /** Resolved org — null if not determinable from event */
    @Column(name = "org_id", columnDefinition = "uuid")
    public UUID orgId;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    public OffsetDateTime receivedAt;

    @Column(name = "processed_at")
    public OffsetDateTime processedAt;

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Call from BillingResource webhook handlers to log incoming events.
     *
     * Example — add to BillingResource.razorpayWebhook():
     *   WebhookEventEntity.log("razorpay", eventType, payload, orgId)
     *       .await().indefinitely();
     */
    public static io.smallrye.mutiny.Uni<WebhookEventEntity> log(
            String gateway,
            String eventType,
            String payload,
            UUID   orgId) {

        WebhookEventEntity e = new WebhookEventEntity();
        e.id        = UUID.randomUUID();
        e.gateway   = gateway;
        e.eventType = eventType;
        e.payload   = payload != null && payload.length() > 32_000
                ? payload.substring(0, 32_000) + "…[truncated]"
                : payload;
        e.status    = "received";
        e.orgId     = orgId;
        return e.persist();
    }

    /** Mark this event as successfully processed */
    public io.smallrye.mutiny.Uni<WebhookEventEntity> markProcessed() {
        this.status      = "processed";
        this.processedAt = OffsetDateTime.now();
        return this.persist();
    }

    /** Mark this event as failed with an error message */
    public io.smallrye.mutiny.Uni<WebhookEventEntity> markFailed(String errorMsg) {
        this.status      = "failed";
        this.error       = errorMsg;
        this.processedAt = OffsetDateTime.now();
        return this.persist();
    }
}