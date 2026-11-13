import { useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { Text } from "@cloudflare/kumo";

export function UploadSection(): JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <section aria-label="Upload" className="space-y-3">
      <label
        data-testid="dropzone"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-kumo-line p-8 text-center"
      >
        <UploadSimple size={32} />
        <Text>Drop a certificate file here, or choose one</Text>
        <input
          type="file"
          aria-label="Certificate file"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
      </label>
      <p data-testid="upload-name" className="text-sm text-kumo-subtle">
        Selected: {fileName ?? "none"}
      </p>
    </section>
  );
}
