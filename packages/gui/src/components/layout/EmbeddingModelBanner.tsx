import { Box, HStack, Text, Button } from "@chakra-ui/react";
import { useState, useEffect, useCallback } from "react";
import { LuDownload, LuCheck, LuTriangleAlert } from "react-icons/lu";
import { embeddingsApi, type EmbeddingModelStatus } from "../../lib/api";
import { useServerEvent } from "../../hooks/useServerEvents";

const POLL_INTERVAL_MS = 10_000;

export function EmbeddingModelBanner() {
  const [status, setStatus] = useState<EmbeddingModelStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Fetch initial status
  useEffect(() => {
    let active = true;
    const check = () => {
      embeddingsApi.status().then((s) => {
        if (!active) return;
        setStatus(s);
        if (s.downloading) {
          setDownloading(true);
          setProgress(s.downloadProgress);
        }
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Listen for real-time progress via WebSocket
  const onProgress = useCallback((data?: unknown) => {
    const d = data as { progress?: number; downloading?: boolean; ready?: boolean } | undefined;
    if (!d) return;
    if (d.progress !== undefined) setProgress(d.progress);
    if (d.downloading !== undefined) setDownloading(d.downloading);
    if (d.ready) {
      setDownloading(false);
      setProgress(100);
      setStatus((prev) => prev ? { ...prev, modelDownloaded: true, serverStatus: "up", downloading: false, downloadProgress: 100, error: null } : prev);
    }
  }, []);

  useServerEvent("embedding-download-progress", onProgress);

  const handleDownload = async () => {
    setDownloading(true);
    setProgress(0);
    try {
      await embeddingsApi.download();
    } catch (err) {
      setDownloading(false);
      setStatus((prev) => prev ? { ...prev, error: String(err) } : prev);
    }
  };

  // Don't render if still loading, model is ready, or user dismissed
  if (!status) return null;
  if (status.modelDownloaded && status.serverStatus === "up" && !downloading) return null;
  if (dismissed && !downloading) return null;

  const hasError = status.error && !downloading;

  return (
    <Box
      bg={hasError ? "red.50" : downloading ? "blue.50" : "orange.50"}
      _dark={{
        bg: hasError ? "red.950" : downloading ? "blue.950" : "orange.950",
      }}
      borderBottomWidth="1px"
      borderColor={hasError ? "red.200" : downloading ? "blue.200" : "orange.200"}
      px="4"
      py="3"
    >
      <HStack justify="space-between" align="center" gap="4">
        <HStack gap="3" flex="1">
          {downloading ? (
            <LuDownload />
          ) : hasError ? (
            <LuTriangleAlert />
          ) : status.modelDownloaded && status.serverStatus === "up" ? (
            <LuCheck />
          ) : (
            <LuTriangleAlert />
          )}
          <Box flex="1">
            <Text fontSize="sm" fontWeight="medium">
              {downloading
                ? "Downloading embeddings model..."
                : hasError
                  ? "Embeddings model download failed"
                  : "Embeddings model not installed"}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {downloading
                ? `Progress: ${Math.round(progress)}%`
                : hasError
                  ? status.error
                  : "The AI search features require the EmbeddingGemma 300M model. Download it to enable legal knowledge search."}
            </Text>
            {downloading && (
              <Box mt="2" bg="gray.200" _dark={{ bg: "gray.700" }} borderRadius="full" h="2" overflow="hidden">
                <Box
                  bg="blue.500"
                  h="full"
                  borderRadius="full"
                  transition="width 0.3s"
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </Box>
            )}
          </Box>
        </HStack>
        <HStack gap="2">
          {!downloading && !hasError && (
            <Button size="sm" colorPalette="blue" onClick={handleDownload}>
              <LuDownload />
              Download Model
            </Button>
          )}
          {hasError && (
            <Button size="sm" colorPalette="red" variant="outline" onClick={handleDownload}>
              Retry
            </Button>
          )}
          {!downloading && (
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}
