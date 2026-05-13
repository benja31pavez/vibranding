import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Viralitycs" },
      { name: "description", content: "Qué cookies usa Viralitycs y cómo puedes controlarlas." },
    ],
  }),
  component: () => (
    <LegalPage title="Política de Cookies" updated="13 de mayo de 2026">
      <p>Este sitio usa cookies y tecnologías similares para que la plataforma funcione y para entender cómo se utiliza.</p>

      <h2>¿Qué es una cookie?</h2>
      <p>Es un pequeño archivo que un sitio guarda en tu navegador para recordar información, como tu sesión o tus preferencias.</p>

      <h2>Tipos de cookies que usamos</h2>
      <ul>
        <li><strong>Esenciales:</strong> necesarias para iniciar sesión y mantener tu sesión activa.</li>
        <li><strong>De preferencias:</strong> recuerdan opciones como cliente activo o vista preferida.</li>
        <li><strong>De analítica:</strong> nos ayudan a medir el uso y mejorar la experiencia.</li>
      </ul>

      <h2>Cookies de terceros</h2>
      <p>Si interactúas con elementos integrados de Meta o Google, esas plataformas pueden colocar sus propias cookies. Te recomendamos revisar sus políticas.</p>

      <h2>Cómo controlarlas</h2>
      <p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que algunas funciones pueden dejar de operar correctamente si las desactivas.</p>

      <h2>Contacto</h2>
      <p>Dudas sobre esta política: <a href="mailto:hola@viralitycs.com">hola@viralitycs.com</a>.</p>
    </LegalPage>
  ),
});
