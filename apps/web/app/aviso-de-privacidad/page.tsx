import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de privacidad',
  description: 'Aviso de privacidad integral de TI24.',
  alternates: { canonical: '/aviso-de-privacidad' },
};

/** Marca visible de dato faltante (D-21): el aviso NO se publica en producción con estos campos vacíos. */
function Pending({ children }: { children: React.ReactNode }) {
  return <span className="pending" data-pending="true">PENDIENTE: {children}</span>;
}

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="container prose">
        <p className="notice" role="note">
          Borrador para revisión. Los campos marcados como <strong>PENDIENTE</strong> deben completarse y el texto
          debe validarlo un especialista en protección de datos antes de publicar el sitio en producción.
        </p>
        <h1 style={{ marginTop: 'var(--s-5)', fontSize: 'var(--fs-xl)' }}>Aviso de privacidad integral</h1>
        <p className="muted small">Última actualización: <Pending>fecha de publicación</Pending></p>

        <h2>1. Responsable</h2>
        <p>
          <Pending>razón social o nombre del titular</Pending> («TI24»), con domicilio en <Pending>domicilio completo</Pending>,
          es responsable del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        </p>

        <h2>2. Datos que recabamos</h2>
        <p>A través del formulario de diagnóstico: nombre, correo de trabajo, empresa, servicio de interés, mensaje y, si decides darlos, teléfono y tamaño de la empresa.</p>
        <p>No recabamos datos personales sensibles.</p>

        <h2>3. Finalidades</h2>
        <p><strong>Necesarias:</strong> responder tu solicitud, agendar y realizar el diagnóstico, preparar y dar seguimiento a propuestas comerciales, y cumplir obligaciones derivadas de una relación comercial.</p>
        <p><strong>Voluntarias:</strong> enviarte ocasionalmente contenido útil de TI24. Solo lo hacemos si marcas la casilla correspondiente en el formulario. Puedes retirar este consentimiento en cualquier momento escribiendo a <Pending>correo para privacidad</Pending>.</p>

        <h2>4. Cookies y medición</h2>
        <p>
          Usamos cookies propias para medir cómo se usa el sitio: un identificador anónimo (180 días) y el canal por el que llegaste
          (por ejemplo, buscador o red social). No usamos cookies de publicidad ni herramientas de medición de terceros.
          Estos datos no te identifican por sí solos; solo se relacionan con tu solicitud cuando envías el formulario.
          Puedes borrarlas desde la configuración de tu navegador.
        </p>

        <h2>5. Transferencias y encargados</h2>
        <p>
          No vendemos ni transferimos tus datos a terceros para sus propios fines. Usamos proveedores que alojan el sitio y la base de datos
          por cuenta de TI24 (encargados): <Pending>lista final de proveedores y países (p. ej., Vercel, Supabase)</Pending>.
        </p>

        <h2>6. Derechos ARCO y revocación</h2>
        <p>
          Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos, o revocar tu consentimiento,
          escribiendo a <Pending>correo para privacidad</Pending> con tu nombre, el derecho que deseas ejercer y un medio para responderte.
          Responderemos en los plazos que establece la ley.
        </p>

        <h2>7. Conservación</h2>
        <p>Conservamos los datos de tu solicitud mientras exista una relación comercial o de seguimiento, y los datos anónimos de navegación hasta 13 meses.</p>

        <h2>8. Cambios a este aviso</h2>
        <p>Publicaremos cualquier cambio en esta misma página, indicando la fecha de actualización.</p>
      </div>
    </section>
  );
}
