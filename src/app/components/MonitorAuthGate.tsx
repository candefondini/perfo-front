"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function MonitorAuthGate({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      window.localStorage.getItem("monitor_auth") === "ok";

    if (!ok) {
      const from = pathname || "/clients";
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    } else {
      setAllowed(true);
    }
  }, [router, pathname]);

  if (!allowed) return null; // pantalla en blanco mientras decide

  return <>{children}</>;
}
