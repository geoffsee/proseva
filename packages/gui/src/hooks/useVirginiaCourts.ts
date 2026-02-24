import { useState, useEffect } from "react";
import { virginiaCourtsApi, type CourtInfo } from "../lib/api";

let courtsCache: CourtInfo[] | null = null;
let fetchPromise: Promise<CourtInfo[]> | null = null;

function fetchCourts(): Promise<CourtInfo[]> {
  if (courtsCache) return Promise.resolve(courtsCache);
  if (!fetchPromise) {
    fetchPromise = virginiaCourtsApi.list().then((data) => {
      courtsCache = data;
      fetchPromise = null;
      return data;
    });
  }
  return fetchPromise;
}

export function useVirginiaCourts() {
  const [courts, setCourts] = useState<CourtInfo[]>(courtsCache ?? []);
  const [loading, setLoading] = useState(!courtsCache);

  useEffect(() => {
    if (courtsCache) {
      return;
    }
    fetchCourts()
      .then(setCourts)
      .finally(() => setLoading(false));
  }, []);

  return { courts, loading };
}
