import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Términos de Servicio — Viralitycs" },
      { name: "description", content: "Términos y condiciones que regulan el uso de los servicios de Viralitycs." },
    ],
  }),
  component: () => (
    <LegalPage title="Términos de Servicio" updated="13 de mayo de 2026">
      <p>Bienvenido a Viralitycs. Al contratar nuestros servicios o usar esta plataforma aceptas los siguientes términos.</p>

      <h2>1. Servicios</h2>
      <p>Viralitycs ofrece servicios de marketing digital enfocados en Instagram y Meta Ads, incluyendo estrategia, diseño, gestión de contenido y campañas pagadas. El alcance específico se acuerda por escrito en cada propuesta.</p>

      <h2>2. Pagos</h2>
      <p>Los honorarios y plazos se definen en la propuesta firmada. Salvo acuerdo distinto, se cobra un anticipo al inicio. La mora superior a 15 días puede causar la suspensión del servicio.</p>

      <h2>3. Propiedad intelectual</h2>
      <p>Todo el material entregado pasa a ser propiedad del cliente una vez pagado en su totalidad. Viralitycs conserva el derecho de mostrar el trabajo en su portafolio salvo solicitud expresa.</p>

      <h2>4. Resultados</h2>
      <p>Aplicamos buenas prácticas de la industria, pero no garantizamos resultados específicos en alcance, seguidores o ventas, ya que dependen de variables fuera de nuestro control.</p>

      <h2>5. Cancelación</h2>
      <p>Los planes mensuales pueden cancelarse con 30 días de aviso. Los proyectos puntuales no son reembolsables una vez iniciados.</p>

      <h2>6. Confidencialidad</h2>
      <p>Tratamos toda la información compartida como confidencial y no la revelamos a terceros sin autorización.</p>

      <h2>7. Limitación de responsabilidad</h2>
      <p>La responsabilidad máxima de Viralitycs ante cualquier reclamo se limita al monto pagado por el cliente en los 3 meses anteriores al hecho que motiva el reclamo.</p>

      <h2>8. Modificaciones</h2>
      <p>Podemos actualizar estos términos. Las modificaciones aplican a partir de su publicación en este sitio.</p>

      <h2>9. Contacto</h2>
      <p>Dudas o reclamos: <a href="mailto:hola@viralitycs.com">hola@viralitycs.com</a>.</p>
    </LegalPage>
  ),
});
