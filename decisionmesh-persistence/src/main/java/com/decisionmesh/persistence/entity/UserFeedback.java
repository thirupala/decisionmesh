package com.decisionmesh.persistence.entity;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * UserFeedback — persists feedback submitted via FeedbackWidget.jsx.
 *
 * Placed in com.decisionmesh.persistence.entity so Quarkus build-time
 * Hibernate scanner picks it up with the rest of your entities.
 *
 * DB table: user_feedback
 * FK:       user_id → users.user_id (UserEntity.userId)
 *
 * SQL migration:
 *   CREATE TABLE user_feedback (
 *       id          UUID        PRIMARY KEY,
 *       user_id     UUID        NOT NULL,
 *       rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
 *       category    VARCHAR(20) NOT NULL,
 *       comment     TEXT,
 *       page        VARCHAR(255),
 *       user_agent  VARCHAR(512),
 *       created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */
@Entity
@Table(name = "user_feedback")
public class UserFeedback extends PanacheEntityBase {

    @Id
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "uuid")
    public UUID id;

    // References users.user_id — matches UserEntity.userId exactly
    @Column(name = "user_id", nullable = false, updatable = false, columnDefinition = "uuid")
    public UUID userId;

    @Column(nullable = false)
    public int rating;

    @Column(nullable = false, length = 20)
    public String category;

    @Column(columnDefinition = "TEXT")
    public String comment;

    @Column(length = 255)
    public String page;

    @Column(name = "user_agent", length = 512)
    public String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public OffsetDateTime createdAt;
}
