// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MaintaFood — Hors ligne</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100dvh;
            background: #080909;
            color: #e4e8f0;
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: #0f1012;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 14px;
            padding: 32px;
            max-width: 380px;
            width: 100%;
            text-align: center;
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
          p { font-size: 14px; color: #7a8599; line-height: 1.6; margin-bottom: 20px; }
          button {
            background: #00c896;
            color: #000;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
          }
          .tip {
            margin-top: 16px;
            padding: 12px;
            background: rgba(0,200,150,.06);
            border: 1px solid rgba(0,200,150,.2);
            border-radius: 8px;
            font-size: 12px;
            color: #00c896;
            text-align: left;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon">📡</div>
          <h1>Hors ligne</h1>
          <p>MaintaFood n'arrive pas à se connecter au réseau. Vérifiez votre connexion WiFi ou données mobiles.</p>
          <button onClick={() => window.location.reload()}>🔄 Réessayer</button>
          <div className="tip">
            💡 Les pages déjà visitées sont disponibles hors ligne. Reconnectez-vous pour synchroniser les nouvelles données.
          </div>
        </div>
      </body>
    </html>
  )
}
