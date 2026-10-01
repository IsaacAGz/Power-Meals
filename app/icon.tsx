import { ImageResponse } from "next/og";

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
          background: "#111111",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32">
          <path
            d="M18.5 2L8 17.5h6.2L13.5 30 24 14.5h-6.4L18.5 2z"
            fill="#F5C400"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
