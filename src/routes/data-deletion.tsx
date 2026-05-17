import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Eliminación de datos — Vibranding" },
      { name: "description", content: "Cómo solicitar la eliminación de tus datos personales en Vibranding." },
    ],
  }),
  component: () => (
    <LegalPage title="Instrucciones para la eliminación de datos" updated="17 de mayo de 2026">
      <p>
        En Vibranding respetamos tu derecho a controlar tus datos personales. Si deseas que eliminemos
        toda la información asociada a tu cuenta —incluidos los datos obtenidos a través de la
        integración con Meta (Facebook e Instagram)— puedes solicitarlo siguiendo las instrucciones de
        esta página.
      </p>

      <h2>1. Qué se eliminará</h2>
      <ul>
        <li>Tu cuenta de usuario y credenciales de acceso.</li>
        <li>Los datos de tu perfil y de los clientes que hayas creado.</li>
        <li>Tokens de acceso, identificadores y métricas obtenidas desde Meta (Facebook/Instagram).</li>
        <li>Cualquier contenido, objetivo o configuración almacenada en la plataforma.</li>
      </ul>

      <h2>2. Cómo solicitar la eliminación</h2>
      <p>Tienes dos opciones:</p>
      <ul>
        <li>
          <strong>Desde la app:</strong> inicia sesión, ve a los ajustes de tu cuenta y pulsa
          “Eliminar cuenta”. La eliminación se procesa de forma automática.
        </li>
        <li>
          <strong>Por email:</strong> envía un correo a{" "}
          <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a> desde la dirección
          asociada a tu cuenta, indicando “Solicitud de eliminación de datos” en el asunto.
        </li>
      </ul>

      <h2>3. Plazo</h2>
      <p>
        Procesaremos tu solicitud en un plazo máximo de 30 días. Una vez completada, recibirás una
        confirmación por correo electrónico. Algunos datos pueden conservarse por obligaciones legales
        (facturación, prevención de fraude) durante el tiempo estrictamente necesario.
      </p>

      <h2>4. Revocar permisos de Meta</h2>
      <p>
        También puedes revocar el acceso de Vibranding a tu cuenta de Facebook o Instagram desde la
        configuración de tu cuenta de Meta, en{" "}
        <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">
          Configuración → Apps y sitios web empresariales
        </a>
        . Esto detendrá el acceso de la app a tus datos, pero no elimina la información ya almacenada
        en Vibranding: para ello debes seguir los pasos anteriores.
      </p>

      <h2>5. Contacto</h2>
      <p>
        Para cualquier duda sobre el tratamiento de tus datos, escríbenos a{" "}
        <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.
      </p>
    </LegalPage>
  ),
});
