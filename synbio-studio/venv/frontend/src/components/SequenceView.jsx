import { useEffect, useMemo, useRef, useState } from "react";
import {
  assembleCircuit,
  formatPercent,
  gcContent,
  typeLabel,
} from "../utils/circuit.js";
import { IconCopy } from "./Icons.jsx";

const LINE = 60;
const SOFT_LIMIT = 3000;

/** Split one display line into runs that each belong to a single part. */
function lineRuns(sequence, segments, start, end) {
  const runs = [];
  let cursor = start;
  while (cursor < end) {
    const segment = segments.find((s) => cursor >= s.start && cursor < s.end);
    const stop = segment ? Math.min(segment.end, end) : end;
    runs.push({
      segment,
      text: sequence.slice(cursor, stop),
      offset: cursor,
    });
    cursor = stop;
  }
  return runs;
}

export default function SequenceView({
  circuit,
  selectedUid,
  onSelect,
  focusToken,
}) {
  const { sequence, segments, length } = useMemo(
    () => assembleCircuit(circuit),
    [circuit],
  );
  const [showAll, setShowAll] = useState(false);
  const bodyRef = useRef(null);
  const markRef = useRef(null);

  const visibleLength = showAll ? length : Math.min(length, SOFT_LIMIT);
  const truncated = visibleLength < length;

  const lines = useMemo(() => {
    const out = [];
    for (let start = 0; start < visibleLength; start += LINE) {
      const end = Math.min(start + LINE, visibleLength);
      out.push({ start, runs: lineRuns(sequence, segments, start, end) });
    }
    return out;
  }, [sequence, segments, visibleLength]);

  useEffect(() => {
    if (!selectedUid) return;
    const node = markRef.current;
    const container = bodyRef.current;
    if (!node || !container) return;
    const top = node.offsetTop - 28;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [selectedUid, focusToken, showAll]);

  if (!length) {
    return (
      <div className="empty">
        <p className="empty-title">No sequence yet</p>
        <p className="empty-body">
          The assembled DNA appears here as you place parts. Each part keeps its
          own colour so you can read the construct boundaries directly.
        </p>
      </div>
    );
  }

  const gc = gcContent(sequence);
  let markAssigned = false;

  return (
    <div className="stack">
      <div className="seq-toolbar">
        <span className="chip mono">{length} bp</span>
        <span className="chip mono" data-tip="Share of G and C bases across the construct">
          GC {formatPercent(gc, 1)}
        </span>
        <span className="chip mono">{segments.length} segments</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => navigator.clipboard?.writeText(sequence)}
          data-tip="Copy the assembled construct sequence"
        >
          <IconCopy width={12} height={12} />
          Copy
        </button>

        <div className="seq-legend">
          {segments.map((segment) => (
            <button
              key={segment.uid}
              type="button"
              className="seq-legend-item"
              data-type={segment.key}
              onClick={() => onSelect(segment.uid)}
            >
              <span className="sw" aria-hidden="true" />
              {segment.part_id}
            </button>
          ))}
        </div>
      </div>

      <div className="seq-map" role="group" aria-label="Construct region map">
        {segments.map((segment) => (
          <button
            key={segment.uid}
            type="button"
            className={`seq-map-seg ${selectedUid === segment.uid ? "active" : ""}`}
            data-type={segment.key}
            style={{ flexGrow: Math.max(segment.length, 1) }}
            onClick={() => onSelect(segment.uid)}
            aria-label={`${typeLabel(segment.part_type)} ${segment.part_id}, ${
              segment.start + 1
            } to ${segment.end}`}
            data-tip={`${segment.part_id} · ${segment.length} bp · ${
              segment.start + 1
            }–${segment.end}`}
            data-tip-pos="below"
          />
        ))}
      </div>

      <div className="seq-body" ref={bodyRef}>
        {lines.map((line) => (
          <div className="seq-line" key={line.start}>
            <span className="seq-num">{line.start + 1}</span>
            <span className="seq-bases">
              {line.runs.map((run, index) => {
                const active = run.segment && run.segment.uid === selectedUid;
                const isMark = active && !markAssigned;
                if (isMark) markAssigned = true;
                return (
                  <span
                    key={`${line.start}-${index}`}
                    ref={isMark ? markRef : undefined}
                    className={`seq-seg ${active ? "active" : ""} ${
                      selectedUid && !active ? "dim" : ""
                    }`}
                    data-type={run.segment ? run.segment.key : "other"}
                    role={run.segment ? "button" : undefined}
                    tabIndex={run.segment ? -1 : undefined}
                    onClick={() => run.segment && onSelect(run.segment.uid)}
                    title={
                      run.segment
                        ? `${run.segment.part_id} · ${typeLabel(run.segment.part_type)}`
                        : undefined
                    }
                  >
                    {run.text}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      {truncated && (
        <div className="seq-toolbar">
          <p className="hint">
            Showing the first {SOFT_LIMIT.toLocaleString()} of{" "}
            {length.toLocaleString()} bases.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => setShowAll(true)}>
            Show full sequence
          </button>
        </div>
      )}
    </div>
  );
}
