import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

export function TermsArticleEs({
  version,
  effective,
  subprocessorsHref,
}: {
  version: string;
  effective: string | null;
  subprocessorsHref: string;
}) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        Estos Términos regulan tu acceso y uso del espacio de trabajo MaxVideoAI (el «Servicio»), incluidas las funciones de vídeo asistido por IA, las recargas del
        wallet, la gestión de trabajos y los recibos. Al crear una cuenta o usar el Servicio aceptas estos Términos, la Política de privacidad y la Política de cookies.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Elegibilidad y edad</h3>
        <p>
          Debes tener al menos <strong>15 años</strong> (o la edad de consentimiento digital en tu país, la que sea mayor) para usar el Servicio. Si actúas en nombre de una empresa
          u organización, declaras que tienes autoridad para vincularla.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Tu cuenta</h3>
        <p>
          Mantén tus credenciales confidenciales y no las compartas. Eres responsable de toda actividad realizada con tu cuenta. Podemos suspender o cancelar cuentas
          que infrinjan estos Términos, hagan un uso indebido del Servicio o violen la ley.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Precios, pagos y wallet</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Pagos gestionados por la plataforma.</strong> Los pagos con tarjeta se procesan mediante Stripe hacia nuestra propia cuenta. No gestionamos pagos divididos.
          </li>
          <li>
            <strong>Recargas del wallet.</strong> Puedes añadir fondos a tu wallet. Los saldos y recibos muestran la moneda indicada en el checkout.
          </li>
          <li>
            <strong>Recibos.</strong> Los recibos detallan el importe pagado (impuestos o descuentos incluidos). No mostramos márgenes ni comisiones internas.
          </li>
          <li>
            <strong>Impuestos.</strong> Según tu ubicación, los precios pueden mostrarse con o sin impuestos. Los tributos aplicables aparecen en el checkout y en los recibos.
          </li>
          <li>
            <strong>Reembolsos.</strong> Si no podemos completar un trabajo por un fallo técnico propio, podemos devolver el cobro al método original o acreditar tu wallet, de acuerdo con la normativa de consumo.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Moneda</h3>
        <p>
          Los cargos pueden realizarse en EUR o USD según tu ubicación o preferencia guardada. Los saldos del wallet y los recibos reflejan la moneda cobrada. Si tu medio de pago usa otra moneda, tu banco puede aplicar comisiones o tipos de cambio.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Resultados asistidos por IA</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Eres responsable de los prompts, entradas y uso de las salidas. No envíes contenido ilegal, infractor o dañino.</li>
          <li>Las salidas son probabilísticas, pueden contener artefactos y ser imprecisas. Revísalas antes de utilizarlas.</li>
          <li>No emplees las salidas para vulnerar derechos (privacidad, imagen, PI) ni leyes. Indica claramente cualquier medio sintético cuando sea obligatorio.</li>
        </ul>
      </section>

      <section id="generated-media-rights" className="stack-gap-sm scroll-mt-[calc(var(--header-height)+24px)]">
        <h3 className="text-lg font-semibold text-text-primary">6. Contenido del usuario y medios generados</h3>
        <p>
          Conservas la propiedad de tus prompts, archivos cargados, referencias, subtítulos y demás activos que aportes al Servicio. Podemos almacenar, procesar y mostrar
          dichos activos únicamente para entregar el render solicitado (texto-a-video o imagen-a-video), encaminar trabajos, habilitar las funciones que hayas activado en
          tu espacio de trabajo y cumplir obligaciones de seguridad. No reclamamos la propiedad de los archivos cargados.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Uso comercial.</strong> Los usuarios pueden usar comercialmente sus generaciones, siempre que respeten los derechos de terceros,
            las leyes aplicables y cualquier restricción específica del modelo o proveedor utilizado.
          </li>
          <li>
            <strong>Licencia sobre los medios generados.</strong> Por cada salida creada con MaxVideoAI nos concedes una licencia mundial, no exclusiva, libre de regalías,
            transferible y sublicenciable para alojar, reproducir, indexar, mostrar y usar esos medios con el fin de (a) operar el Servicio, (b) mejorar el enrutamiento, las
            protecciones y los modelos, (c) realizar investigaciones de seguridad o abuso y (d) mostrar galerías de Ejemplos, páginas de plantillas, casos de uso u otras
            acciones de marketing.
          </li>
          <li>
            <strong>Controles de privacidad.</strong> Los nuevos renders son privados por defecto. La publicación pública, la indexación general del sitio y cualquier inclusión en el rollout de Video SEO son gestionadas por MaxVideoAI mediante un flujo interno de revisión. Si necesitas retirar, desindexar o eliminar un render público, puedes escribir a{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
              unstyled
              className="font-medium"
            />
            ; atenderemos la solicitud salvo obligación legal en contrario.
          </li>
          <li>
            <strong>Cargas vs. contenido generado.</strong> Los logotipos, imágenes o vídeos que cargas siguen siendo tuyos; solo los usamos para producir el render o resolver
            incidencias. Las salidas también son tuyas, sujetas a la licencia anterior, y eres responsable de los derechos de terceros incluidos en tus entradas o salidas.
          </li>
          <li>
            <strong>Nuestra propiedad intelectual.</strong> MaxVideoAI mantiene la propiedad de la plataforma, las interfaces, los pipelines, las mejoras técnicas y los sistemas
            de seguridad. Estos Términos no te transfieren esos derechos.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Propiedad del Servicio</h3>
        <p>
          Nosotros y nuestros licenciantes poseemos el Servicio, incluidos software, modelos, herramientas de seguridad, interfaz, documentación y marcas. Salvo los derechos
          limitados aquí otorgados, no se transfiere propiedad intelectual alguna.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Uso aceptable</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Prohibido el reverse engineering, el acceso no autorizado o interferir con el Servicio.</li>
          <li>Prohibido enviar contenido ilegal, difamatorio, de odio o que infrinja derechos.</li>
          <li>Prohibido usar las salidas para identificación biométrica, vigilancia o prácticas engañosas sin los permisos y avisos necesarios.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Servicios de terceros</h3>
        <p>
          Dependemos de subencargados de confianza (Stripe para pagos, proveedores de hosting/CDN, almacenamiento, bases de datos, partners de inferencia). Consulta la
          Política de privacidad y la{' '}
          <Link href={subprocessorsHref} className="text-brand underline hover:text-brandHover">
            lista actualizada de subencargados
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Disponibilidad y cambios</h3>
        <p>
          Buscamos una alta disponibilidad pero no podemos garantizar un servicio ininterrumpido. Las funciones pueden cambiar o retirarse avisando con antelación cuando sea posible.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Garantías y exenciones</h3>
        <p>
          El Servicio se ofrece “tal cual”, sin garantías de comerciabilidad, idoneidad para un propósito específico ni ausencia de infracción. Las salidas pueden ser inexactas;
          las usas bajo tu propio riesgo.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Límite de responsabilidad</h3>
        <p>
          En la medida permitida por la ley, nuestra responsabilidad total se limita a los importes que nos pagaste en los 12 meses previos al evento que originó la reclamación.
          Esta cláusula no limita las responsabilidades que no puedan excluirse legalmente.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnización</h3>
        <p>Te comprometes a indemnizarnos frente a reclamaciones derivadas de tu contenido, de tu uso de las salidas o del incumplimiento de estos Términos.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">14. Terminación</h3>
        <p>
          Puedes dejar de usar el Servicio en cualquier momento. Podemos suspender o terminar el acceso si hay incumplimientos, riesgos para el Servicio o exigencias legales. Las
          secciones relativas a propiedad intelectual, exenciones, responsabilidad e indemnización sobreviven a la terminación.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">15. Ley aplicable y jurisdicción</h3>
        <p>
          Estos Términos se rigen por la ley francesa. Los tribunales de París tienen jurisdicción exclusiva, sin perjuicio de las protecciones imperativas de tu país de residencia.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">16. Derechos del consumidor y desistimiento</h3>
        <p>
          Si eres consumidor en la UE/EEE/Reino Unido, puedes disponer de derechos legales (desistimiento, conformidad). Nada en estos Términos limita dichos derechos.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">17. Cambios y nuevo consentimiento</h3>
        <p>
          Podemos actualizar estos Términos. Cuando haya cambios sustanciales te lo notificaremos y podremos requerir que aceptes la nueva versión en tu siguiente inicio de sesión.
          La versión vigente y su fecha aparecen arriba.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">18. Contacto</h3>
        <p>
          ¿Dudas sobre estos Términos? Escribe a{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Última actualización: {effective ?? version}</p>
      </section>
    </article>
  );
}
