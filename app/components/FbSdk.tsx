"use client";

import Script from "next/script";

export default function FbSdk() {
  return (
    <Script
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
      onLoad={() => {
        // @ts-expect-error FB global
        window.FB.init({
          appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
          cookie: true,
          xfbml: false,
          version: "v21.0",
        });
      }}
    />
  );
}
