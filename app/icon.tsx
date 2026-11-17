import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E0E0E",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#F5C400",
            fontSize: 17,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: -1,
          }}
        >
          PM
        </div>
      </div>
    ),
    { ...size },
  );
}
