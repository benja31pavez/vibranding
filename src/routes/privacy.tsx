import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidad — Vibranding" },
      { name: "description", content: "Cómo Vibranding recopila, usa y protege tus datos personales." },
    ],
  }),
  component: () => (
    <LegalPage title="Política de Privacidad" updated="13 de mayo de 2026">
      <p>En Vibranding respetamos tu privacidad. Esta política explica qué datos recopilamos y cómo los usamos.</p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li>Datos de contacto: nombre, email, teléfono, marca o empresa.</li>
        <li>Datos de cuenta: credenciales de acceso a la plataforma.</li>
        <li>Datos operativos: información de tus campañas y cuentas que tú nos compartes para ejecutar el servicio.</li>
        <li>Datos de uso: páginas visitadas, eventos, tipo de dispositivo.</li>
      </ul>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Prestar y mejorar nuestros servicios.</li>
        <li>Comunicarnos contigo sobre tu proyecto.</li>
        <li>Cumplir obligaciones legales y contables.</li>
      </ul>

      <h2>3. Compartir con terceros</h2>
      <p>No vendemos tus datos. Solo los compartimos con proveedores que nos ayudan a operar (hosting, analítica, plataformas de publicidad), bajo acuerdos de confidencialidad.</p>

      <h2>4. Seguridad</h2>
      <p>Aplicamos medidas técnicas y organizativas razonables para proteger tu información, incluyendo cifrado en tránsito y control de accesos.</p>

      <h2>5. Tus derechos</h2>
      <p>Puedes acceder, corregir o eliminar tus datos en cualquier momento contactándonos por los canales indicados en el sitio.</p>

      <h2>6. Conservación</h2>
      <p>Conservamos tus datos mientras dure la relación comercial y por el tiempo que la ley nos exija después.</p>

      <h2>7. Cambios</h2>
      <p>Podemos actualizar esta política. Publicaremos los cambios en esta misma página.</p>
    </LegalPage>
  ),
});
