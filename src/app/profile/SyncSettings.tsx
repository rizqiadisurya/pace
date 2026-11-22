"use client";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { clearSyncConfig, consumeStravaRedirect, setSyncConfig, stravaConnectUrl, syncNow, describeSummary, testConnection } from "@/lib/sync";
import { useSyncConfig } from "@/lib/usePace";

const field = "h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink";

/** Pengaturan koneksi ke sync-api (Vercel) untuk Garmin & Strava. */
export function SyncSettings() {
  const config = useSyncConfig();
  const [apiUrl, setApiUrl] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config) return;
    setApiUrl((v) => v || config.apiUrl);
    setKey((v) => v || config.key);
  }, [config]);

  useEffect(() => {
    const r = consumeStravaRedirect();
    if (r) {
      setMsg({ ok: r.ok, text: r.message });
      document.getElementById("sinkron")?.scrollIntoView({ block: "start" });
    }
  }, []);

  if (!config) return null;
  const connected = !!config.apiUrl && !!config.key;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const url = apiUrl.trim().replace(/\/+$/, "");
      if (!/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url)) throw new Error("Alamat harus diawali https://");
      const h = await testConnection(url, key.trim());
      setSyncConfig({ apiUrl: url, key: key.trim(), garminEnabled: h.garmin, stravaEnabled: h.strava && !!config!.stravaRefresh });
      setMsg({
        ok: true,
        text: `Terhubung. Garmin ${h.garmin ? "siap" : "belum diatur di server"} · Strava ${h.strava ? "siap untuk dihubungkan" : "belum diatur di server"}.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal terhubung." });
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    setBusy(true);
    setMsg(null);
    try {
      const s = await syncNow();
      setMsg({ ok: true, text: `Sinkron selesai: ${describeSummary(s)}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Sinkron gagal." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div id="sinkron" className="scroll-mt-6">
        <h2 className="text-[15px] font-semibold">Sinkronisasi Garmin & Strava</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Lari, tidur, dan HRV masuk otomatis lewat sync API milikmu sendiri. Data tetap tersimpan di perangkat ini.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted">
        Alamat sync API
        <input className={field} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://pace-sync-xxx.vercel.app" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted">
        Kata sandi sinkron
        <input className={field} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="SYNC_PASSPHRASE di Vercel" autoComplete="off" />
      </label>
      <Button variant="outline" disabled={busy || !apiUrl || !key} onClick={() => void save()}>
        {connected ? "Simpan & tes ulang" : "Simpan & tes koneksi"}
      </Button>

      {connected && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
          <Row label="Garmin" value={config.garminEnabled ? "Aktif" : "Belum diatur di server (GARMIN_API_KEY)"} ok={config.garminEnabled} />
          <Row
            label="Strava"
            value={config.stravaRefresh ? `Terhubung${config.stravaAthlete ? ` sebagai ${config.stravaAthlete}` : ""}` : "Belum terhubung"}
            ok={!!config.stravaRefresh}
          />
          <div className="flex gap-2">
            {config.stravaRefresh ? (
              <Button variant="ghost" className="flex-1" onClick={() => setSyncConfig({ stravaRefresh: null, stravaAthlete: null, stravaEnabled: false })}>
                Putuskan Strava
              </Button>
            ) : (
              <a href={stravaConnectUrl(config)} className="inline-flex h-12 flex-1 items-center justify-center rounded-[14px] bg-[#fc4c02] text-[15px] font-semibold text-white">
                Hubungkan Strava
              </a>
            )}
            <Button className="flex-1" disabled={busy || (!config.garminEnabled && !config.stravaRefresh)} onClick={() => void syncAll()}>
              Sinkron sekarang
            </Button>
          </div>
          {config.lastWarnings.length > 0 && <p className="text-[12px] text-muted">Catatan terakhir: {config.lastWarnings.join(" · ")}</p>}
          <button className="min-h-11 self-start text-[13px] font-medium text-muted underline underline-offset-2" onClick={() => (clearSyncConfig(), setApiUrl(""), setKey(""), setMsg(null))}>
            Hapus pengaturan sinkron
          </button>
        </div>
      )}
      {msg && <p className={`text-[13px] ${msg.ok ? "text-ok" : "text-accent-ink"}`}>{msg.text}</p>}
    </Card>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[14px]">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-ok" : "bg-line"}`} aria-hidden="true" />
      <span className="w-16 font-semibold">{label}</span>
      <span className="text-muted">{value}</span>
    </div>
  );
}
