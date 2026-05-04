package com.decisionmesh.bootstrap.service;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * KafkaHealthService — queries the Kafka broker for lag, topic offsets,
 * and partition health to populate the System Health dashboard.
 *
 * Uses the blocking Apache Kafka AdminClient wrapped in a Uni running on
 * a worker thread — keeps the Vert.x event loop free.
 *
 * Topics and consumer group are configurable via application.properties:
 *   kafka.bootstrap.servers          — broker address
 *   kafka.health.topics              — comma-separated topic names to monitor
 *   kafka.health.consumer-group      — consumer group to measure lag against
 *   kafka.health.timeout-ms          — per-operation timeout (default 5000)
 */
@ApplicationScoped
public class KafkaHealthService {

    @Inject
    Vertx vertx;

    @ConfigProperty(name = "kafka.bootstrap.servers", defaultValue = "localhost:9092")
    String bootstrapServers;

    @ConfigProperty(name = "kafka.health.topics",
            defaultValue = "intent-events,execution-events,governance-events")
    List<String> healthTopics;

    @ConfigProperty(name = "kafka.health.consumer-group",
            defaultValue = "decisionmesh-consumer")
    String consumerGroup;

    @ConfigProperty(name = "kafka.health.timeout-ms", defaultValue = "5000")
    int timeoutMs;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns Kafka health metrics as a Map ready to embed in the health response.
     * Runs the blocking AdminClient calls on a worker thread.
     * Never fails the outer Uni — errors are captured in the map as "status: down".
     */
    public Uni<Map<String, Object>> getHealth() {
        // vertx.executeBlocking() runs fetchMetrics() on a Vert.x worker thread
        // and delivers the result BACK on the original Vert.x event loop context.
        // This is critical — runSubscriptionOn(workerPool) delivered results on
        // the wrong thread, causing Hibernate Reactive's @WithSession to throw:
        //   HR000069: Detected use of the reactive Session from a different Thread
        // executeBlocking() avoids that by honouring the original Vert.x context.
        return vertx.executeBlocking(
                Uni.createFrom().item(this::fetchMetrics)
        );
    }

    // ── Implementation ────────────────────────────────────────────────────────

    private Map<String, Object> fetchMetrics() {
        Properties props = new Properties();
        props.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG,        bootstrapServers);
        props.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG,       String.valueOf(timeoutMs));
        props.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG,   String.valueOf(timeoutMs));
        props.put(AdminClientConfig.CONNECTIONS_MAX_IDLE_MS_CONFIG,  "10000");

        try (AdminClient admin = AdminClient.create(props)) {
            return buildMetrics(admin);
        } catch (Exception ex) {
            Log.warnf("[KafkaHealth] Broker unreachable at %s — %s", bootstrapServers, ex.getMessage());
            return buildDownResponse(ex.getMessage());
        }
    }

    private Map<String, Object> buildMetrics(AdminClient admin) {
        // Wrap entire method — any uncaught exception returns a degraded map
        // rather than propagating and wiping out the DB data in the health response.
        try {
            return buildMetricsInternal(admin);
        } catch (Exception ex) {
            Log.errorf(ex, "[KafkaHealth] Unexpected error building Kafka metrics");
            return buildDownResponse(ex.getMessage());
        }
    }

    private Map<String, Object> buildMetricsInternal(AdminClient admin) throws Exception {

        // ── 1. Describe topics (partition count, leaders) ─────────────────────
        Map<String, TopicDescription> descriptions = Map.of();
        try {
            descriptions = admin.describeTopics(healthTopics)
                    .allTopicNames()
                    .get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            // Topics don't exist yet — mark them as missing but keep going
            Log.warnf("[KafkaHealth] describeTopics failed (topics may not exist yet): %s",
                    e.getClass().getSimpleName());
        }

        // Collect all partitions across monitored topics
        List<TopicPartition> allPartitions = descriptions.values().stream()
                .flatMap(td -> td.partitions().stream()
                        .map(p -> new TopicPartition(td.name(), p.partition())))
                .collect(Collectors.toList());

        // ── 2. End offsets (latest — how many messages exist) ─────────────────
        Map<TopicPartition, Long> endOffsets = new HashMap<>();
        if (!allPartitions.isEmpty()) {
            try {
                Map<TopicPartition, OffsetSpec> req = new HashMap<>();
                allPartitions.forEach(tp -> req.put(tp, OffsetSpec.latest()));
                admin.listOffsets(req).all()
                        .get(timeoutMs, TimeUnit.MILLISECONDS)
                        .forEach((tp, info) -> endOffsets.put(tp, info.offset()));
            } catch (Exception e) {
                Log.warnf("[KafkaHealth] listOffsets(latest) failed: %s", e.getMessage());
            }
        }

        // ── 3. Earliest offsets (for total message count = end - earliest) ────
        Map<TopicPartition, Long> earliestOffsets = new HashMap<>();
        if (!allPartitions.isEmpty()) {
            try {
                Map<TopicPartition, OffsetSpec> req = new HashMap<>();
                allPartitions.forEach(tp -> req.put(tp, OffsetSpec.earliest()));
                admin.listOffsets(req).all()
                        .get(timeoutMs, TimeUnit.MILLISECONDS)
                        .forEach((tp, info) -> earliestOffsets.put(tp, info.offset()));
            } catch (Exception e) {
                Log.warnf("[KafkaHealth] listOffsets(earliest) failed: %s", e.getMessage());
            }
        }

        // ── 4. Consumer group committed offsets (lag = end − committed) ───────
        Map<TopicPartition, OffsetAndMetadata> committed = new HashMap<>();
        try {
            Map<TopicPartition, OffsetAndMetadata> raw =
                    admin.listConsumerGroupOffsets(consumerGroup)
                            .partitionsToOffsetAndMetadata()
                            .get(timeoutMs, TimeUnit.MILLISECONDS);
            if (raw != null) committed.putAll(raw);
        } catch (Exception e) {
            // Consumer group may not exist yet — not an error, lag defaults to 0
            Log.warnf("[KafkaHealth] listConsumerGroupOffsets(%s) failed (%s) — lag defaults to 0",
                    consumerGroup, e.getClass().getSimpleName());
        }

        // ── 5. Per-topic summary ──────────────────────────────────────────────
        List<Map<String, Object>> topicList = new ArrayList<>();
        long totalLag = 0;

        for (String topicName : healthTopics) {
            Map<String, Object> topicInfo = new LinkedHashMap<>();
            topicInfo.put("name", topicName);

            TopicDescription desc = descriptions.get(topicName);
            if (desc == null) {
                topicInfo.put("status", "missing");
                topicList.add(topicInfo);
                continue;
            }

            topicInfo.put("status",     "up");
            topicInfo.put("partitions", desc.partitions().size());

            long topicEnd = 0, topicEarliest = 0, topicLag = 0;
            List<Map<String, Object>> partitionDetails = new ArrayList<>();

            for (var partInfo : desc.partitions()) {
                TopicPartition tp  = new TopicPartition(topicName, partInfo.partition());
                long end           = endOffsets.getOrDefault(tp, 0L);
                long earliest      = earliestOffsets.getOrDefault(tp, 0L);
                // If consumer hasn't committed for this partition, treat lag as 0
                long committedOff  = committed.containsKey(tp)
                        ? committed.get(tp).offset() : end;
                long lag           = Math.max(0, end - committedOff);

                topicEnd      += end;
                topicEarliest += earliest;
                topicLag      += lag;

                Map<String, Object> pDetail = new LinkedHashMap<>();
                pDetail.put("partition",  partInfo.partition());
                pDetail.put("endOffset",  end);
                pDetail.put("committed",  committedOff);
                pDetail.put("lag",        lag);
                pDetail.put("leader",     partInfo.leader() != null ? partInfo.leader().id() : -1);
                partitionDetails.add(pDetail);
            }

            totalLag += topicLag;
            topicInfo.put("totalMessages",   Math.max(0, topicEnd - topicEarliest));
            topicInfo.put("endOffset",       topicEnd);
            topicInfo.put("consumerLag",     topicLag);
            topicInfo.put("partitionDetail", partitionDetails);
            topicList.add(topicInfo);
        }

        // ── 6. Broker node count ──────────────────────────────────────────────
        int brokerCount = 0;
        try {
            brokerCount = admin.describeCluster().nodes()
                    .get(timeoutMs, TimeUnit.MILLISECONDS).size();
        } catch (Exception e) {
            Log.warnf("[KafkaHealth] describeCluster failed: %s", e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        // outboxDepth = total messages across all monitored topics (end - earliest).
        // Used as a proxy for outbox queue depth on the health dashboard.
        long outboxDepth = topicList.stream()
                .filter(t -> "up".equals(t.get("status")))
                .mapToLong(t -> ((Number) t.getOrDefault("totalMessages", 0L)).longValue())
                .sum();

        result.put("status",       "up");
        result.put("broker",       bootstrapServers + " (" + brokerCount + " node" + (brokerCount != 1 ? "s" : "") + ")");
        result.put("consumerLag",  totalLag);
        result.put("outboxDepth",  outboxDepth);
        result.put("consumerGroup",consumerGroup);
        result.put("topics",       topicList);
        return result;
    } // end buildMetricsInternal

    private Map<String, Object> buildDownResponse(String error) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status",          "down");
        result.put("bootstrapServer", bootstrapServers);
        result.put("error",           error);
        result.put("topics",          healthTopics.stream()
                .map(t -> Map.of("name", t, "status", "unknown"))
                .collect(Collectors.toList()));
        return result;
    }
}