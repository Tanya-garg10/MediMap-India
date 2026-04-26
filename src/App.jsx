import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ─── Google Font loader ──────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.href =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg: "#0B0F14",
  card: "#11161C",
  border: "#1F2937",
  text: "#E5E7EB",
  muted: "#6B7280",
  accent: "#3B82F6",
  High: { color: "#22C55E", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", progress: "100%", label: "HIGH TRUST", summary: "Verified · Safe for referral." },
  Medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", progress: "60%", label: "MED TRUST", summary: "Partial match · Call ahead." },
  Low: { color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", progress: "20%", label: "LOW TRUST", summary: "Critical gaps · Do not rely on stated capabilities." },
  Flagged: { color: "#6B7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", progress: "0%", label: "FLAGGED", summary: "Fraud indicators detected · DO NOT refer patients." },
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Mock data (fallback) ─────────────────────────────────────────────────────
const MOCK_HOSPITALS = [
  {
    id: 1, name: "AIIMS Patna", location: "Phulwari Sharif, Bihar", pin: "801505",
    lat: 25.5471, lng: 85.0637, trust_score: "High", distance: "8.1 km",
    reasoning: "Strengths: NABH accredited; Government operated; 24hr anesthesiologist available; Blood bank available; Trauma center; Large facility (960 beds); Telemedicine enabled; Recently verified/audited.",
    details: "ICU_beds: 120 | Anesthesiologist: Multiple teams (24hr) | OT: 12 functional | Blood_bank: Yes | NABH: Yes | Trauma_center: Yes",
    facilities: ["Trauma Center", "ICU 120 beds", "Blood Bank", "NABH Accredited", "12 OTs", "Telemedicine"],
    beds: 960, contact: "1800-180-2222",
    chain_of_thought: ["Location detected: state Bihar", "Medical needs: general", "Emergency: no", "Database matches: 10 facilities", "Ranked by relevance + trust score"],
  },
  {
    id: 2, name: "Patna Medical College & Hospital", location: "Patna, Bihar", pin: "800004",
    lat: 25.6093, lng: 85.1376, trust_score: "High", distance: "2.3 km",
    reasoning: "Strengths: NABH accredited; Government operated; 24hr anesthesiologist available; Blood bank available; Large facility (850 beds); Recently verified/audited.",
    details: "ICU_beds: 48 | Anesthesiologist: Yes (24hr) | Emergency_surgery: Yes | OT: 4 functional | Blood_bank: Yes",
    facilities: ["ICU 48 beds", "Blood Bank", "24/7 Emergency", "NABH Accredited", "4 OTs"],
    beds: 850, contact: "+91-612-2300001",
    chain_of_thought: ["Location detected: state Bihar", "Medical needs: general", "Emergency: no", "Database matches: 10 facilities"],
  },
  {
    id: 3, name: "Sadar Government Hospital", location: "Chapra, Bihar", pin: "841301",
    lat: 25.7742, lng: 84.7388, trust_score: "Medium", distance: "45 km",
    reasoning: "Strengths: Government operated. Concerns: Key staff only part-time; Equipment shortages or non-functional systems reported.",
    details: "ICU_beds: 0 | Anesthesiologist: Part-time (9AM–5PM only) | OT: 2 functional | Blood_bank: No",
    facilities: ["OT (2)", "Day Emergency Only", "General Ward", "Pharmacy"],
    beds: 200, contact: "+91-6152-232451",
    chain_of_thought: [],
  },
  {
    id: 4, name: "Rural Health Center Sonepur", location: "Sonepur, Bihar", pin: "841101",
    lat: 25.6892, lng: 85.1832, trust_score: "Low", distance: "68 km",
    reasoning: "Concerns: Claims surgical capability but no anesthesiologist on record; Equipment shortages or non-functional systems reported; Patient complaints on record.",
    details: "ICU_beds: 0 | Anesthesiologist: UNVERIFIED | OT: Possibly non-functional since Apr 2023",
    facilities: ["Basic OPD", "Limited Emergency"],
    beds: 30, contact: "+91-6181-222101",
    chain_of_thought: [],
  },
  {
    id: 5, name: "New Life Super Specialty Clinic", location: "Hajipur, Bihar", pin: "844101",
    lat: 25.6878, lng: 85.2093, trust_score: "Flagged", distance: "22 km",
    reasoning: "Concerns: Claims Cardiac Surgery, Neurosurgery with only ~1 staff listed; Zero beds but claims surgical capability. Fraud signals: advanced claims minimal staff; multiple unverified claims; fraud keywords in notes; verification failed.",
    details: "Claimed: Advanced Cardiac Surgery, Neurosurgery. Verified_staff: 1 MBBS. License: NOT FOUND. Fraud_score: 0.87",
    facilities: ["Claimed: ICU", "Claimed: Cardiac", "Claimed: Neuro"],
    beds: 0, contact: "Not Verified",
    chain_of_thought: [],
  },
  {
    id: 6, name: "IGIMS Patna", location: "Sheikhpura, Patna, Bihar", pin: "800014",
    lat: 25.6244, lng: 85.0868, trust_score: "High", distance: "5.2 km",
    reasoning: "Strengths: Government operated; 24hr anesthesiologist available; Blood bank available; Large facility (700 beds); Recently verified/audited.",
    details: "ICU 80 beds | Dialysis Unit | Blood Bank | 8 OTs | Cancer Center",
    facilities: ["ICU 80 beds", "Dialysis Unit", "Blood Bank", "8 OTs", "Cancer Center"],
    beds: 700, contact: "+91-612-2297631",
    chain_of_thought: [],
  },
];

const MOCK_MAP_DATA = MOCK_HOSPITALS.map(h => ({
  id: h.id, name: h.name, location: h.location, pin: h.pin,
  lat: h.lat, lng: h.lng, trust_score: h.trust_score, beds: h.beds,
  specialties: "", facilities: h.facilities.join(", "),
}));

const SAMPLE_QUERIES = [
  "nearest hospital in rural Bihar for emergency appendectomy",
  "ICU with blood bank within 15km of Patna",
  "NABH accredited hospital in Chapra with 24/7 anesthesiologist",
];

const PLACEHOLDER_CYCLE = [
  "nearest hospital in rural Bihar for emergency appendectomy...",
  "ICU with blood bank within 15km of Patna...",
  "NABH accredited hospital with 24/7 anesthesiologist...",
  "trauma center near Muzaffarpur for road accident...",
  "emergency dialysis in rural Bihar...",
];

// ─── Custom Cursor ────────────────────────────────────────────────────────────
function CustomCursor() {
  const dotRef = useRef(null);
  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;
    let raf, mx = -100, my = -100;
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    const loop = () => { if (dot) dot.style.transform = `translate(${mx - 4}px, ${my - 4}px)`; raf = requestAnimationFrame(loop); };
    window.addEventListener("mousemove", move);
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={dotRef} style={{ position: "fixed", top: 0, left: 0, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", pointerEvents: "none", zIndex: 9999, opacity: 0.7, willChange: "transform" }} />;
}

// ─── Map Fly Helper ───────────────────────────────────────────────────────────
function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom || 8, { duration: 1.2 }); }, [center, zoom]);
  return null;
}

// ─── Trust color helper ───────────────────────────────────────────────────────
function trustColor(score) {
  return { High: "#22C55E", Medium: "#F59E0B", Low: "#EF4444", Flagged: "#6B7280" }[score] || "#6B7280";
}

// ─── India Map Component ──────────────────────────────────────────────────────
function IndiaMap({ hospitals, searchResults, onHospitalClick }) {
  const [flyTarget, setFlyTarget] = useState(null);
  const [flyZoom, setFlyZoom] = useState(6);

  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      const first = searchResults.find(h => h.lat && h.lng);
      if (first) { setFlyTarget([first.lat, first.lng]); setFlyZoom(9); }
    }
  }, [searchResults]);

  const displayData = searchResults && searchResults.length > 0 ? searchResults : hospitals;
  const searchIds = new Set((searchResults || []).map(h => h.id));

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, height: 400 }}>
      <MapContainer center={[25.0, 83.0]} zoom={6} style={{ height: "100%", width: "100%", background: T.bg }}
        zoomControl={true} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapFlyTo center={flyTarget} zoom={flyZoom} />
        {(hospitals || []).map(h => {
          if (!h.lat || !h.lng) return null;
          const isResult = searchIds.has(h.id);
          const color = trustColor(h.trust_score);
          return (
            <CircleMarker key={h.id} center={[h.lat, h.lng]}
              radius={isResult ? 8 : 4}
              pathOptions={{ color: isResult ? color : "rgba(107,114,128,0.3)", fillColor: color, fillOpacity: isResult ? 0.8 : 0.25, weight: isResult ? 2 : 0.5 }}
              eventHandlers={{ click: () => onHospitalClick && onHospitalClick(h) }}>
              <Popup>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{h.name}</div>
                  <div style={{ color: "#666", marginBottom: 2 }}>{h.location}</div>
                  <div style={{ color: trustColor(h.trust_score), fontWeight: 600 }}>
                    {(T[h.trust_score] || T.Low).label}
                  </div>
                  {h.beds > 0 && <div style={{ color: "#888", marginTop: 2 }}>{h.beds} beds</div>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// ─── Chain of Thought Panel ───────────────────────────────────────────────────
function ChainOfThought({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ margin: "12px 0", padding: 14, borderRadius: 10, background: "rgba(59,130,246,0.04)", border: `1px solid rgba(59,130,246,0.15)` }}>
      <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", color: T.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12 }}>🧠</span> AI CHAIN OF THOUGHT
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: i === steps.length - 1 ? "rgba(59,130,246,0.15)" : T.bg, border: `1px solid ${i === steps.length - 1 ? "rgba(59,130,246,0.4)" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: i === steps.length - 1 ? T.accent : T.muted, fontFamily: "IBM Plex Mono, monospace" }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.7, paddingTop: 2 }}>
              {step}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Medical Desert Banner ────────────────────────────────────────────────────
function MedicalDesertBanner({ hospitals }) {
  if (!hospitals || hospitals.length === 0) return null;
  const total = hospitals.length;
  const highTrust = hospitals.filter(h => h.trust_score === "High").length;
  const flagged = hospitals.filter(h => h.trust_score === "Flagged").length;
  const lowOrFlagged = hospitals.filter(h => h.trust_score === "Low" || h.trust_score === "Flagged").length;
  const desertRatio = total > 0 ? (total - highTrust) / total : 0;

  if (desertRatio < 0.7) return null;

  return (
    <div style={{ margin: "12px 0", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>🏜️</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#FCA5A5", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
          MEDICAL DESERT DETECTED
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "IBM Plex Mono, monospace", marginTop: 2 }}>
          Only {highTrust} of {total} facilities have High trust. {lowOrFlagged} are Low/Flagged. This area has critical healthcare gaps.
        </div>
      </div>
    </div>
  );
}

// ─── HospitalCard ─────────────────────────────────────────────────────────────
function HospitalCard({ hospital, rank, visible }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cfg = T[hospital.trust_score] || T.Low;

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", borderRadius: 10, background: T.card, border: `1px solid ${hovered ? cfg.border : T.border}`, overflow: "hidden", transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.3s ease", opacity: visible ? 1 : 0, transform: visible ? (hovered ? "translateY(-1px) scale(1.005)" : "translateY(0) scale(1)") : "translateY(10px)", boxShadow: hovered ? "0 4px 24px rgba(0,0,0,0.35)" : "none" }}>
      {/* Left accent */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: cfg.color, borderRadius: "10px 0 0 10px" }} />

      <div style={{ padding: "16px 18px 14px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Rank */}
          <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.muted, fontFamily: "IBM Plex Mono, monospace", marginTop: 2 }}>
            {rank}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + trust badge */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{hospital.name}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                {cfg.label}
              </span>
              {hospital.trust_score === "Flagged" && (
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em", background: "rgba(127,29,29,0.3)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5" }}>
                  ⚠ DO NOT REFER
                </span>
              )}
            </div>

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: T.muted, fontFamily: "IBM Plex Mono, monospace", marginBottom: 10 }}>
              <span>📍 {hospital.location}{hospital.pin ? ` · ${hospital.pin}` : ""}</span>
              {hospital.distance && <span style={{ color: T.accent }}>◎ {hospital.distance}</span>}
              {hospital.beds > 0 && <span>{hospital.beds} beds</span>}
            </div>

            {/* Trust bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 9, color: "#374151", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase", width: 36, flexShrink: 0 }}>Trust</span>
              <div style={{ flex: 1, height: 3, borderRadius: 4, background: T.border }}>
                <div style={{ height: 3, borderRadius: 4, background: cfg.color, width: cfg.progress, transition: "width 0.8s ease" }} />
              </div>
            </div>

            {/* Reasoning preview */}
            <p style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.65, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              <span style={{ color: "#374151", fontFamily: "IBM Plex Mono, monospace", marginRight: 5, fontSize: 10 }}>AI ▸</span>
              {hospital.reasoning}
            </p>

            {/* Facility chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {(hospital.facilities || []).map((f) => (
                <span key={f} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "IBM Plex Mono, monospace", background: T.bg, border: `1px solid ${T.border}`, color: T.muted }}>{f}</span>
              ))}
            </div>

            {/* Expand / contact row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: T.accent, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.85 }}>
                <span style={{ transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "none", display: "inline-block", fontSize: 9 }}>▶</span>
                {expanded ? "Hide" : "View"} AI reasoning &amp; raw data
              </button>
              {hospital.contact && hospital.contact !== "Not Verified" && (
                <span style={{ fontSize: 10, color: "#374151", fontFamily: "IBM Plex Mono, monospace" }}>📞 {hospital.contact}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ margin: "0 18px 18px 50px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, padding: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>AI CHAIN OF THOUGHT</div>
            <div style={{ borderRadius: 6, padding: 10, border: `1px solid ${T.border}`, fontSize: 12, color: "#CBD5E1", lineHeight: 1.7 }}>
              {hospital.reasoning}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>RAW FACILITY RECORD</div>
            <div style={{ borderRadius: 6, padding: 10, border: `1px solid ${T.border}`, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#4B5563", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {hospital.details}
            </div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
            <strong>Trust Score: {hospital.trust_score}</strong> — {cfg.summary}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [visibleCards, setVisibleCards] = useState([]);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_CYCLE[0]);
  const [activeTab, setActiveTab] = useState("results"); // results | map
  const [mapHospitals, setMapHospitals] = useState([]);
  const [stats, setStats] = useState(null);
  const phIdx = useRef(0);
  const inputRef = useRef(null);

  // Load map data on mount
  useEffect(() => {
    const loadMap = async () => {
      try {
        const res = await fetch(`${API_BASE}/hospitals/map`);
        if (res.ok) setMapHospitals(await res.json());
        else setMapHospitals(MOCK_MAP_DATA);
      } catch { setMapHospitals(MOCK_MAP_DATA); }
    };
    const loadStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats`);
        if (res.ok) setStats(await res.json());
      } catch { /* ignore */ }
    };
    loadMap();
    loadStats();
  }, []);

  // Rotating placeholder
  useEffect(() => {
    const t = setInterval(() => {
      phIdx.current = (phIdx.current + 1) % PLACEHOLDER_CYCLE.length;
      setPlaceholder(PLACEHOLDER_CYCLE[phIdx.current]);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // Stagger card visibility
  useEffect(() => {
    if (results.length === 0) { setVisibleCards([]); return; }
    setVisibleCards([]);
    results.forEach((_, i) => { setTimeout(() => setVisibleCards((v) => [...v, i]), i * 90); });
  }, [results]);

  const handleSearch = async (q) => {
    const searchQ = q !== undefined ? q : query;
    if (!searchQ.trim()) return;
    setLoading(true);
    setSearched(true);
    setResults([]);
    setUsingMock(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${API_BASE}/query?q=${encodeURIComponent(searchQ)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Bad response");
      const data = await res.json();
      // Ensure facilities is always an array
      setResults(data.map(h => ({
        ...h,
        facilities: Array.isArray(h.facilities) ? h.facilities : (h.facilities || "").split(",").map(f => f.trim()).filter(Boolean),
      })));
    } catch {
      clearTimeout(timeoutId);
      setUsingMock(true);
      await new Promise((r) => setTimeout(r, 1200));
      setResults(MOCK_HOSPITALS);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery(""); setResults([]); setSearched(false); setUsingMock(false); setVisibleCards([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const trustCounts = results.reduce((a, h) => { a[h.trust_score] = (a[h.trust_score] || 0) + 1; return a; }, {});
  const chainOfThought = results.length > 0 && results[0].chain_of_thought ? results[0].chain_of_thought : [];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "IBM Plex Sans, sans-serif", cursor: "none" }}>
      <CustomCursor />

      {/* ── Header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: T.accent, position: "relative" }}>
            ⊕
            <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#22C55E", border: `2px solid ${T.bg}` }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "-0.01em" }}>
              MediMap-<span style={{ color: T.accent }}>India</span>
            </div>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Healthcare Discovery · India
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {searched && results.length > 0 && (
            <button onClick={handleClear} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer", letterSpacing: "0.04em" }}>
              ← New Search
            </button>
          )}
          {stats && (
            <div style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", fontSize: 10, color: "#60A5FA", fontFamily: "IBM Plex Mono, monospace" }}>
              {stats.total} facilities
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#4ADE80", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.08em" }}>AI LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 80px" }}>
        {/* Hero / Search area */}
        <div style={{ paddingTop: searched ? 24 : 64, paddingBottom: searched ? 0 : 28, transition: "padding 0.35s ease" }}>
          {!searched && (
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 4, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: 18 }}>
                <span style={{ color: T.accent, fontSize: 10 }}>✦</span>
                <span style={{ fontSize: 10, color: "#60A5FA", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em" }}>
                  10,000+ VERIFIED FACILITIES · BIHAR &amp; BEYOND
                </span>
              </div>
              <h1 style={{ fontSize: "clamp(24px, 4.5vw, 34px)", fontWeight: 700, color: T.text, lineHeight: 1.25, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Find the right hospital.<br /><span style={{ color: T.accent }}>Before it's too late.</span>
              </h1>
              <p style={{ fontSize: 13, color: T.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>
                AI-powered facility discovery with trust scoring. Every result explains why a hospital was recommended — or flagged.
              </p>
            </div>
          )}

          {/* Search bar */}
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "0 8px 0 14px", color: T.muted, fontSize: 15, flexShrink: 0, lineHeight: 1 }}>⌕</div>
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={placeholder} disabled={loading} autoComplete="off"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "13px 8px", fontSize: 13, color: T.text, fontFamily: "IBM Plex Mono, monospace", caretColor: T.accent, cursor: "text", minWidth: 0 }} />
              {query && !loading && (
                <button onClick={handleClear} style={{ padding: "0 10px", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
              )}
              <button onClick={() => handleSearch()} disabled={loading || !query.trim()}
                style={{ margin: 6, padding: "8px 16px", borderRadius: 7, background: loading || !query.trim() ? T.border : T.accent, border: "none", cursor: loading || !query.trim() ? "not-allowed" : "pointer", color: loading || !query.trim() ? T.muted : "#fff", fontSize: 12, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, transition: "background 0.15s" }}>
                {loading ? (<><span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${T.muted}`, borderTopColor: T.text, animation: "spin 0.7s linear infinite", display: "inline-block" }} />Scanning</>) : (<>Search ⏎</>)}
              </button>
            </div>
          </div>

          {/* Sample queries */}
          {!searched && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginTop: 14 }}>
              {SAMPLE_QUERIES.map((q) => (
                <button key={q} onClick={() => { setQuery(q); handleSearch(q); }}
                  style={{ padding: "5px 12px", borderRadius: 4, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map section on landing */}
        {!searched && mapHospitals.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>🗺️</span> FACILITY MAP · COLOR BY TRUST SCORE
            </div>
            <IndiaMap hospitals={mapHospitals} searchResults={null} onHospitalClick={null} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
              {[["High", "#22C55E"], ["Medium", "#F59E0B"], ["Low", "#EF4444"], ["Flagged", "#6B7280"]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "IBM Plex Mono, monospace", color: T.muted }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mock banner */}
        {usingMock && (
          <div style={{ margin: "12px 0", padding: "9px 14px", borderRadius: 8, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#F59E0B", fontSize: 13 }}>⚡</span>
            <span style={{ fontSize: 11, color: "#FCD34D", fontFamily: "IBM Plex Mono, monospace" }}>
              Demo mode · API unavailable. Showing mock Bihar dataset. Start FastAPI at <code style={{ color: "#F59E0B" }}>localhost:8000</code> for live results.
            </span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", paddingTop: 52, paddingBottom: 32 }}>
            <div style={{ position: "relative", width: 44, height: 44, margin: "0 auto 18px" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${T.border}` }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: T.accent, animation: "spin 0.9s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: T.accent, opacity: 0.7 }}>⊕</div>
            </div>
            <p style={{ fontSize: 13, color: "#9CA3AF", fontFamily: "IBM Plex Mono, monospace", margin: "0 0 4px" }}>AI agent processing query...</p>
            <p style={{ fontSize: 11, color: T.muted, fontFamily: "IBM Plex Mono, monospace", margin: 0 }}>Cross-referencing facility records · Scoring trust · Ranking</p>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8, maxWidth: 580, margin: "20px auto 0" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 80, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Results area */}
        {!loading && results.length > 0 && (
          <>
            {/* Chain of Thought */}
            <ChainOfThought steps={chainOfThought} />

            {/* Medical Desert Warning */}
            <MedicalDesertBanner hospitals={results} />

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 4, margin: "12px 0", background: T.card, borderRadius: 8, padding: 3, border: `1px solid ${T.border}`, width: "fit-content" }}>
              {[["results", "📋 Results"], ["map", "🗺️ Map"]].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", border: "none", cursor: "pointer", background: activeTab === key ? T.accent : "transparent", color: activeTab === key ? "#fff" : T.muted, transition: "all 0.15s" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Stats strip */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0", alignItems: "center" }}>
              {[
                { label: "Results", val: results.length, color: T.accent, bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
                { label: "High", val: trustCounts.High || 0, color: "#22C55E", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
                { label: "Medium", val: trustCounts.Medium || 0, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
                { label: "Low", val: trustCounts.Low || 0, color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
                { label: "Flagged", val: trustCounts.Flagged || 0, color: "#6B7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: s.bg, border: `1px solid ${s.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "IBM Plex Mono, monospace" }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: "IBM Plex Mono, monospace" }}>{s.label}</span>
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 10, color: "#374151", fontFamily: "IBM Plex Mono, monospace", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, animation: "pulse 2s infinite" }} />
                AI-ranked by relevance &amp; trust
              </div>
            </div>

            {/* Map view */}
            {activeTab === "map" && (
              <div style={{ marginBottom: 16 }}>
                <IndiaMap hospitals={mapHospitals} searchResults={results} onHospitalClick={null} />
              </div>
            )}

            {/* Results list */}
            {activeTab === "results" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((h, i) => (
                  <HospitalCard key={h.id || i} hospital={h} rank={i + 1} visible={visibleCards.includes(i)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 52, color: T.muted, fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>⊘</div>
            <p style={{ margin: "0 0 20px" }}>No facilities found for this query.</p>
            <p style={{ fontSize: 11, color: "#374151", marginBottom: 14 }}>Try one of these:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
              {SAMPLE_QUERIES.map((q) => (
                <button key={q} onClick={() => { setQuery(q); handleSearch(q); }}
                  style={{ padding: "5px 12px", borderRadius: 4, fontSize: 11, fontFamily: "IBM Plex Mono, monospace", border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        input::placeholder { color: #374151; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 2px; }
        .leaflet-container { background: #0B0F14 !important; }
        .leaflet-popup-content-wrapper { background: #11161C !important; color: #E5E7EB !important; border: 1px solid #1F2937 !important; border-radius: 8px !important; }
        .leaflet-popup-tip { background: #11161C !important; }
        @media (max-width: 540px) {
          main { padding: 0 10px 60px !important; }
          h1   { font-size: 22px !important; }
        }
      `}</style>
    </div>
  );
}
