import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import type { PrivacyBodyProps } from './PrivacyArticle';

export function PrivacyArticleEs({
  version,
  effective,
  links,
}: {
  version: string;
  effective: string | null;
  links: PrivacyBodyProps['links'];
}) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        Esta política explica cómo MaxVideoAI («nosotros») recopila, utiliza, comparte y protege tus datos personales cuando visitas maxvideoai.com, creas una cuenta, adquieres recargas o generas
        contenido con IA.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Alcance</h3>
        <p>
          Cubre el tratamiento de datos dentro del espacio de trabajo de MaxVideoAI: gestión de cuentas, facturación, analíticas, generación de contenido y soporte.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Datos que tratamos</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Cuenta e identidad:</strong> nombre, e-mail, hash de contraseña, país/región, idioma.
          </li>
          <li>
            <strong>Transacciones:</strong> operaciones de la billetera, recargas, recibos (importe, divisa, impuestos, marcas de tiempo), IDs de trabajos.
          </li>
          <li>
            <strong>Pagos:</strong> procesados por Stripe; guardamos identificadores y metadatos mínimos, nunca números completos de tarjeta.
          </li>
          <li>
            <strong>Uso y telemetría:</strong> datos del dispositivo, IP, user-agent, ubicación aproximada, flags, diagnósticos de errores, logs.
          </li>
          <li>
            <strong>Contenido:</strong> prompts, entradas, salidas generadas y archivos subidos necesarios para prestar el Servicio.
          </li>
          <li>
            <strong>Consentimientos y preferencias:</strong> versiones legales aceptadas, opciones de cookies, opt-in de marketing, divisa preferida.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Finalidades y bases legales (RGPD)</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Prestar el Servicio:</strong> gestión de cuentas, wallet, trabajos de vídeo, soporte — base legal: contrato.
          </li>
          <li>
            <strong>Pagos y prevención de fraude:</strong> procesamiento y monitorización — bases: contrato, interés legítimo, obligación legal.
          </li>
          <li>
            <strong>Analítica y mejora:</strong> medición de uso para mejorar funciones — bases: consentimiento para cookies no esenciales; de lo contrario, interés legítimo con salvaguardas.
          </li>
          <li>
            <strong>Emails de marketing:</strong> envío de novedades cuando aceptas recibirlas — base: consentimiento, revocable en cualquier momento.
          </li>
          <li>
            <strong>Cumplimiento y seguridad:</strong> registros, auditorías, respuesta a incidentes — bases: obligación legal e interés legítimo.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Conservación</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Datos de cuenta:</strong> mientras el acceso esté activo, más un periodo limitado de respaldos.
          </li>
          <li>
            <strong>Recibos y registros financieros:</strong> guardados según los plazos que marque la normativa contable.
          </li>
          <li>
            <strong>Logs y telemetría:</strong> periodos cortos salvo que se necesiten para seguridad o investigaciones.
          </li>
          <li>Anonimizamos o borramos los datos cuando dejan de ser necesarios para las finalidades descritas.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Compartición y subencargados</h3>
        <p>Trabajamos con proveedores de confianza:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Stripe (pagos)</li>
          <li>Hosting/CDN (p. ej. Vercel)</li>
          <li>Almacenamiento objeto (p. ej. AWS S3)</li>
          <li>Bases de datos y autenticación (Neon, Supabase)</li>
          <li>Proveedores de inferencia IA (p. ej. Fal.ai)</li>
          <li>Herramientas de e-mail y soporte</li>
        </ul>
        <p>
          Firmamos acuerdos de tratamiento con cada proveedor. Consulta la lista actualizada en{' '}
          <Link href={links.subprocessorsHref} className="text-brand underline hover:text-brandHover">
            {links.subprocessorsHref}
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">6. Transferencias internacionales</h3>
        <p>
          Cuando los datos salen del EEE/Reino Unido, usamos garantías adecuadas como las Cláusulas Contractuales Tipo e implementamos medidas adicionales si es necesario.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Seguridad</h3>
        <p>
          Aplicamos medidas técnicas y organizativas (cifrado en tránsito, controles de acceso, mínimo privilegio, monitorización, respuesta ante incidentes). Ningún método es infalible, así que
          recomendamos contraseñas robustas y, cuando exista, autenticación en dos pasos.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Cookies y tecnologías similares</h3>
        <p>
          Usamos cookies esenciales para el funcionamiento y, con tu consentimiento, cookies de analítica o publicidad. Puedes retirar el consentimiento desde el banner o los ajustes. Consulta la{' '}
          <Link href={links.cookiesHref} className="text-brand underline hover:text-brandHover">
            Política de cookies
          </Link>{' '}
          para más información.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Tus derechos (UE/EEE/R.-U.)</h3>
        <p>
          Según la ley aplicable puedes ejercer acceso, rectificación, supresión, restricción, portabilidad u oposición. También puedes retirar tu consentimiento escribiendo a{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          . Puedes presentar reclamaciones ante tu autoridad local (por ejemplo, la AEPD o la CNIL).
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Menores</h3>
        <p>El Servicio no está dirigido a menores de 15/16 años. Si crees que un menor nos facilitó datos sin el consentimiento adecuado, avísanos para eliminarlos.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Cambios</h3>
        <p>
          Podemos actualizar esta Política. Cualquier cambio importante se comunicará en la app o por correo y puede requerir un nuevo consentimiento. La versión vigente y la fecha figuran arriba.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Contacto</h3>
        <p>
          ¿Dudas sobre privacidad? Escribe a{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Última actualización: {effective ?? version}</p>
      </section>
    </article>
  );
}
