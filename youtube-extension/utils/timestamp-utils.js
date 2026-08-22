/**
 * timestamp-utils.js — Utilities for YouTube video timestamp handling.
 *
 * Maps video timestamps to transcript segments, handles seeking,
 * and provides human-readable timestamp formatting.
 */

/**
 * Find transcript segment(s) matching a given video time.
 * Returns segments that overlap with [time - tolerance, time + tolerance].
 *
 * @param {Array<{text: string, start: number, duration: number}>} segments
 * @param {number} time - video.currentTime in seconds
 * @param {number} tolerance - seconds before/after to search
 * @returns {Array} matching segments
 */
function findSegmentsAtTime(segments, time, tolerance = 0.5) {
  if (!segments || segments.length === 0) return [];
  return segments.filter(seg => {
    const end = seg.start + (seg.duration || 5);
    return time >= (seg.start - tolerance) && time <= (end + tolerance);
  });
}

/**
 * Get all segments within a time window.
 * Used for accumulating context around a specific timestamp.
 *
 * @param {Array} segments
 * @param {number} fromTime - window start (seconds)
 * @param {number} toTime - window end (seconds)
 * @returns {Array}
 */
function getSegmentsInWindow(segments, fromTime, toTime) {
  if (!segments) return [];
  return segments.filter(seg => {
    const end = seg.start + (seg.duration || 5);
    // Include if segment overlaps with [fromTime, toTime]
    return seg.start <= toTime && end >= fromTime;
  });
}

/**
 * Find the index of the segment closest to a given time.
 * @param {Array} segments
 * @param {number} time
 * @returns {number} index, or -1 if no segments
 */
function findClosestSegmentIndex(segments, time) {
  if (!segments || segments.length === 0) return -1;
  let closest = 0;
  let minDiff = Infinity;
  segments.forEach((seg, i) => {
    const diff = Math.abs(seg.start - time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  });
  return closest;
}

/**
 * Extract a context window of text around a given timestamp.
 * Groups adjacent segments into one coherent text block.
 *
 * @param {Array} segments
 * @param {number} centerTime
 * @param {number} windowSeconds - total window size (centered on centerTime)
 * @returns {{ text: string, startTime: number, endTime: number }}
 */
function extractContextWindow(segments, centerTime, windowSeconds = 30) {
  const half = windowSeconds / 2;
  const windowSegments = getSegmentsInWindow(
    segments,
    centerTime - half,
    centerTime + half
  );

  if (windowSegments.length === 0) return { text: '', startTime: centerTime, endTime: centerTime };

  const text = windowSegments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  const startTime = windowSegments[0].start;
  const lastSeg = windowSegments[windowSegments.length - 1];
  const endTime = lastSeg.start + (lastSeg.duration || 5);

  return { text, startTime, endTime };
}

/**
 * Format a duration in seconds as "Xm Ys" or "Xs".
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Parse a MM:SS or HH:MM:SS timestamp string into seconds.
 * @param {string} ts
 * @returns {number}
 */
function parseTimestamp(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
