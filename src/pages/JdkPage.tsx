import { useState } from "react";
import { Search, Download, Trash2, Loader2 } from "lucide-react";
import type { JdkInfo } from "../types";

interface JdkPageProps {
  jdks: JdkInfo[];
  loading: boolean;
  discoverJdks: () => Promise<JdkInfo[] | null>;
  downloadAndInstallJdk: (majorVersion: number, vendor: string) => Promise<JdkInfo | null>;
  removeJdk: (jdkId: string) => Promise<void>;
}

const JDK_VERSIONS = [8, 11, 17, 21];
const JDK_VENDORS = ["Adoptium", "Corretto", "GraalVM"];

const sourceLabels: Record<string, { label: string; color: string }> = {
  system: { label: "系统", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  downloaded: { label: "已下载", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  manual: { label: "手动", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

export default function JdkPage({
  jdks,
  loading,
  discoverJdks,
  downloadAndInstallJdk,
  removeJdk,
}: JdkPageProps) {
  const [downloadVersion, setDownloadVersion] = useState(21);
  const [downloadVendor, setDownloadVendor] = useState("Adoptium");
  const [downloading, setDownloading] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const handleDiscover = async () => {
    setDiscovering(true);
    await discoverJdks();
    setDiscovering(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    await downloadAndInstallJdk(downloadVersion, downloadVendor);
    setDownloading(false);
  };

  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          JDK 管理
        </h1>
        <button
          onClick={handleDiscover}
          disabled={discovering || loading}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {discovering ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          发现 JDK
        </button>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* JDK List */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            已安装的 JDK ({jdks.length})
          </h2>

          {jdks.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              暂无已安装的 JDK，点击"发现 JDK"扫描系统或下载新版本。
            </p>
          ) : (
            <div className="space-y-2">
              {jdks.map((jdk) => {
                const source = sourceLabels[jdk.source] ?? sourceLabels.manual;
                return (
                  <div
                    key={jdk.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-lg dark:bg-orange-900/30">
                        ☕
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          JDK {jdk.version}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {jdk.vendor} &middot; {jdk.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${source.color}`}
                      >
                        {source.label}
                      </span>
                      {jdk.source === "downloaded" && (
                        <button
                          onClick={() => removeJdk(jdk.id)}
                          disabled={loading}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Download Section */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            下载 JDK
          </h2>

          <div className="flex flex-wrap items-end gap-3">
            {/* Version Selector */}
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                版本
              </label>
              <select
                value={downloadVersion}
                onChange={(e) => setDownloadVersion(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {JDK_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    JDK {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor Selector */}
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                发行版
              </label>
              <select
                value={downloadVendor}
                onChange={(e) => setDownloadVendor(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {JDK_VENDORS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={downloading || loading}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  下载并安装
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
