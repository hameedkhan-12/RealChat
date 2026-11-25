-- Add composite index to support the dashboard conversation inbox query:
-- WHERE domainId = ? [AND status = ?] ORDER BY lastActivityAt DESC, id ASC
-- Cursor pagination on (lastActivityAt, id).
CREATE INDEX "ChatRoom_domainId_status_lastActivityAt_idx" ON "ChatRoom"("domainId", "status", "lastActivityAt");
