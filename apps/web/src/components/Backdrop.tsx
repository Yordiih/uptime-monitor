// Decorative background shared by the app pages. The blobs are static on purpose:
// the dashboard stays open for long periods, so it should cost almost no CPU or GPU.
export default function Backdrop() {
  return (
    <div className="app-bg" aria-hidden="true">
      <span className="app-blob a" />
      <span className="app-blob b" />
      <span className="app-blob c" />
    </div>
  );
}
