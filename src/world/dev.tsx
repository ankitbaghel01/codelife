import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CityMap } from "./CityMap";
import { OfficeScene, Reception } from "./OfficeScene";
import { companyById } from "./companies";

const SAMPLE_INVITES = [
  {
    id: "i1",
    companyId: "sutradhar",
    roleId: "jr-web",
    day: 3,
    time: 660,
    status: "accepted",
  },
  {
    id: "i2",
    companyId: "kiranacart",
    roleId: "frontend",
    day: 4,
    time: 900,
    status: "pending",
  },
  {
    id: "i3",
    companyId: "rupiya",
    roleId: "sde1",
    day: 2,
    time: 600,
    status: "expired",
  },
];

type View = "map" | "sutradhar" | "kiranacart";

/** Dev preview for the world pieces; the lead mounts it behind `?world=1`. */
export function WorldDev() {
  const [view, setView] = useState<View>(
    () => (new URLSearchParams(location.search).get("view") as View) || "map",
  );
  const [checkedIn, setCheckedIn] = useState(false);
  const company = view !== "map" ? companyById(view)! : null;
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {company && (
        <Canvas
          shadows
          camera={{ fov: 70, near: 0.05, far: 60 }}
          dpr={[1, 1.75]}
        >
          <OfficeScene
            key={company.id}
            company={company}
            onReady={() => console.log("office ready", company.id)}
          />
        </Canvas>
      )}
      {company && !checkedIn && (
        <Reception
          company={company}
          time={660}
          onCheckIn={() => setCheckedIn(true)}
          onLeave={() => setView("map")}
        />
      )}
      {view === "map" && (
        <CityMap
          day={3}
          minute={9 * 60 + 40}
          invitations={SAMPLE_INVITES}
          job={null}
          workWhy={null}
          onGo={(id) => {
            const c = id.startsWith("company:") ? id.slice(8) : "";
            if (c === "sutradhar" || c === "kiranacart") {
              setCheckedIn(false);
              setView(c);
            } else console.log("go", id);
          }}
          onClose={() => console.log("close map")}
        />
      )}
      <nav
        style={{
          position: "fixed",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          display: "flex",
          gap: 8,
        }}
      >
        {(["map", "sutradhar", "kiranacart"] as View[]).map((v) => (
          <button
            key={v}
            className="btn small"
            onClick={() => (setCheckedIn(true), setView(v))}
          >
            {v}
          </button>
        ))}
      </nav>
    </div>
  );
}
