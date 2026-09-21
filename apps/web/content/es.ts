/**
 * Textos del sitio en español (D-15: contenido separado del código desde el día 1).
 * Reglas de voz (AT-12 §6, D-19, D-20): oraciones normales, frases cortas, beneficios concretos,
 * sin superlativos, sin «24/7», sin testimonios ni clientes citados.
 * Todo texto aquí es BORRADOR hasta que Abraham lo apruebe.
 */
import type { ServiceCode } from '@ti24/contracts';

export const site = {
  name: 'TI24',
  tagline: 'Software, sitios y marketing para empresas que quieren ordenar cómo consiguen y atienden clientes.',
  description:
    'TI24 diseña, construye y mantiene software a medida, sitios web, aplicaciones y marketing digital para empresas en México y Estados Unidos. Empezamos con un diagnóstico.',
  locale: 'es_MX',
};

export const nav = {
  skip: 'Saltar al contenido',
  links: [
    { href: '/desarrollo-de-software', label: 'Desarrollo de software' },
    { href: '/#servicios', label: 'Servicios' },
    { href: '/#como-trabajamos', label: 'Cómo trabajamos' },
  ],
  cta: 'Agenda tu diagnóstico',
  langSwitch: { href: '/en', label: 'English', hrefLang: 'en' },
};

export const serviceNames: Record<ServiceCode, string> = {
  DIAG: 'Diagnóstico',
  WEB: 'Sitio web',
  MKT: 'Marketing digital',
  SOC: 'Gestión de redes',
  SYS: 'Software a medida',
  APP: 'Aplicación',
  MNT: 'Mantenimiento y soporte',
  'EDU-IC': 'Capacitación para tu equipo',
  'EDU-OP': 'Cursos abiertos',
};

export const home = {
  eyebrow: 'Tecnología para empresas · México y EE. UU.',
  title: 'Herramientas digitales que tu empresa sí puede usar y sostener.',
  lead: 'Construimos el software, el sitio y el marketing con los que tu empresa consigue y atiende clientes. Y nos quedamos para mantenerlos. Todo empieza con un diagnóstico.',
  primary: 'Agenda tu diagnóstico',
  secondary: 'Ver desarrollo de software',
  linesTitle: 'Lo que hacemos',
  linesLead: 'Una puerta de entrada y cuatro líneas de trabajo. Puedes empezar por cualquiera; el diagnóstico te dice por dónde conviene.',
  lines: [
    { code: 'DIAG', name: 'Diagnóstico', text: 'Una conversación de 45 minutos para entender tu operación. Sales con prioridades claras y, si aplica, una propuesta con alcance.', href: '/diagnostico' },
    { code: 'Captar', name: 'Captar', text: 'Sitios web y marketing digital para que te encuentren y te contacten. Cada contacto queda registrado.', href: '/diagnostico?servicio=WEB' },
    { code: 'Construir', name: 'Construir', text: 'Software a medida y aplicaciones para sacar tu operación de hojas de cálculo, correos y chats sueltos.', href: '/desarrollo-de-software' },
    { code: 'Sostener', name: 'Sostener', text: 'Mantenimiento y soporte para lo que ya funciona: actualizaciones, respaldos y mejoras.', href: '/diagnostico?servicio=MNT' },
    { code: 'Capacitar', name: 'Capacitar', text: 'Cursos para que tu equipo use lo que se construyó. Disponibles bajo oferta.', href: null },
  ],
  methodTitle: 'Cómo trabajamos',
  method: [
    { n: '01', title: 'Diagnóstico', text: 'Entendemos el problema, el proceso actual y lo que ya tienes.' },
    { n: '02', title: 'Propuesta', text: 'Alcance, entregables, tiempos y precio por escrito, antes de empezar.' },
    { n: '03', title: 'Construcción', text: 'Avances que puedes revisar en cada etapa, no una caja negra.' },
    { n: '04', title: 'Mantenimiento', text: 'Soporte, mejoras y capacitación para que la herramienta siga viva.' },
  ],
  case0Title: 'Nuestro primer caso somos nosotros',
  case0Text:
    'Este sitio y el sistema comercial que lo respalda —registro de contactos, seguimiento y propuestas— los construimos con el mismo método que te proponemos. Preferimos mostrarte cómo trabajamos a mostrarte logotipos.',
  fitTitle: 'Para quién es',
  fitYes: [
    'Empresas que venden a otras empresas y siguen a sus clientes por WhatsApp, Excel y correo.',
    'Equipos que necesitan una herramienta a su medida, no otra suscripción que nadie usa.',
    'Negocios que quieren un sitio que genere contactos, no solo una tarjeta de presentación.',
  ],
  fitNoTitle: 'Para quién no',
  fitNo: [
    'Proyectos que buscan «la próxima gran app» con presupuesto de página sencilla.',
    'Quien solo busca seguidores o «likes».',
  ],
  finalTitle: '¿Por dónde empezar?',
  finalText: 'Cuéntanos qué te gustaría resolver. Revisamos tu caso y te proponemos una llamada de diagnóstico.',
};

export const software = {
  serviceCode: 'SYS' as const,
  eyebrow: 'Construir · Software a medida',
  title: 'Software a medida para sacar tu operación de las hojas de cálculo.',
  lead: 'Cotizaciones, pedidos, inventarios, seguimiento de clientes: si hoy vive en archivos sueltos y chats, lo convertimos en un sistema que tu equipo usa todos los días.',
  primary: 'Agenda tu diagnóstico',
  problemTitle: '¿Te suena?',
  problems: [
    'Cada cotización se arma a mano y nadie sabe cuál es la versión vigente.',
    'La información del cliente está repartida entre el correo, WhatsApp y tres archivos de Excel.',
    'Cuando alguien falta, el proceso se detiene porque solo esa persona sabe dónde está todo.',
    'Pagaste una herramienta genérica que no se adapta a cómo trabajas y el equipo volvió a Excel.',
  ],
  forTitle: 'Para quién es',
  forYes: [
    'Empresas con un proceso repetitivo y claro que hoy se hace a mano.',
    'Equipos de 5 a 200 personas que necesitan ver la misma información.',
    'Negocios que ya probaron herramientas genéricas y no les funcionaron.',
  ],
  forNo: [
    'Procesos que todavía no están definidos: primero conviene ordenarlos (el diagnóstico ayuda).',
    'Sistemas regulados que requieren certificaciones especiales (salud, finanzas).',
  ],
  deliverablesTitle: 'Qué entregamos',
  deliverables: [
    { title: 'Sistema web funcionando', text: 'Accesible desde computadora y celular, con usuarios y permisos.' },
    { title: 'Tus datos, en tu cuenta', text: 'Base de datos con respaldos. La información es de tu empresa.' },
    { title: 'Código documentado', text: 'Repositorio con historial de cambios, para que nadie dependa de una sola persona.' },
    { title: 'Capacitación de arranque', text: 'Tu equipo aprende a usarlo con sus propios casos.' },
  ],
  howTitle: 'Cómo trabajamos',
  how: [
    { n: '01', title: 'Diagnóstico', text: 'Mapeamos el proceso actual y definimos qué debe resolver el sistema primero.' },
    { n: '02', title: 'Propuesta con alcance', text: 'Entregables, tiempos y precio por escrito. Sin sorpresas.' },
    { n: '03', title: 'Entregas por etapas', text: 'Ves avances funcionando en cada etapa y los corriges a tiempo.' },
    { n: '04', title: 'Arranque y mantenimiento', text: 'Acompañamos la puesta en marcha y ofrecemos un plan de mantenimiento.' },
  ],
  proofTitle: 'Prueba',
  proofText:
    'Nuestro propio sistema comercial —el que registra cada solicitud de este sitio, la convierte en oportunidad y da seguimiento hasta el proyecto— es nuestro primer caso documentado.',
  priceTitle: 'Precio',
  priceText: 'Cada sistema es distinto. Cotizamos por alcance después del diagnóstico, con precio cerrado por etapa.',
  faqTitle: 'Preguntas frecuentes',
  faq: [
    { q: '¿Cuánto tarda un sistema a medida?', a: 'Depende del alcance. En el diagnóstico definimos una primera etapa útil y su tiempo estimado; así empiezas a usar algo real pronto.' },
    { q: '¿El código y los datos son míos?', a: 'Sí. Se acuerda por escrito en la propuesta: el repositorio y la base de datos quedan a nombre de tu empresa.' },
    { q: '¿Se conecta con lo que ya uso?', a: 'Cuando la herramienta actual lo permite (por ejemplo, correo, hojas de cálculo o sistemas con API), sí. Lo revisamos en el diagnóstico.' },
    { q: '¿Qué pasa después de la entrega?', a: 'Puedes contratar mantenimiento: actualizaciones, respaldos, correcciones y mejoras pequeñas cada mes.' },
  ],
  finalTitle: 'Cuéntanos qué proceso quieres ordenar',
  finalText: 'Llena el formulario de diagnóstico. Revisamos tu caso y te proponemos una llamada.',
};

export const diagnostic = {
  eyebrow: 'Diagnóstico',
  title: 'Agenda tu diagnóstico',
  lead: 'Cuéntanos qué te gustaría resolver. Revisamos tu solicitud y te contactamos para acordar una llamada de 45 minutos.',
  whatTitle: 'Qué incluye',
  what: [
    'Revisión de tu proceso actual y de las herramientas que ya usas.',
    'Prioridades claras: qué conviene resolver primero.',
    'Si aplica, una propuesta con alcance, tiempos y precio por escrito.',
  ],
  form: {
    full_name: 'Nombre',
    email: 'Correo de trabajo',
    emailHint: 'Usaremos este correo para responderte.',
    company: 'Empresa',
    service_code: '¿Qué te interesa?',
    message: '¿Qué te gustaría resolver?',
    messageHint: 'Por ejemplo: «Cotizamos en Excel y perdemos el seguimiento».',
    phone: 'Teléfono (opcional)',
    company_size: 'Tamaño de la empresa (opcional)',
    sizeOptions: { '': 'Prefiero no decir', '1-9': '1 a 9 personas', '10-49': '10 a 49', '50-199': '50 a 199', '200+': '200 o más' },
    privacy: 'He leído y acepto el',
    privacyLink: 'aviso de privacidad',
    marketing: 'Quiero recibir ocasionalmente contenido útil de TI24 (opcional).',
    submit: 'Enviar solicitud',
    submitting: 'Enviando…',
    errorGeneric: 'No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.',
    errorRate: 'Recibimos varias solicitudes seguidas. Espera unos minutos e intenta de nuevo.',
    errorCaptcha: 'No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.',
    required: 'Obligatorio',
  },
};

export const thanks = {
  title: 'Recibimos tu solicitud',
  lead: 'Gracias. Revisaremos tu caso y te escribiremos al correo que nos diste para acordar la llamada de diagnóstico.',
  nextTitle: 'Mientras tanto',
  next: [
    'Ten a la mano un ejemplo real del proceso que quieres mejorar (un archivo, una captura, un formato).',
    'Piensa quién más de tu equipo debería estar en la llamada.',
  ],
  back: 'Volver al inicio',
};

export const notFound = {
  title: 'Esta página no existe',
  lead: 'Puede que el enlace esté mal escrito o que la página se haya movido.',
  links: [
    { href: '/', label: 'Ir al inicio' },
    { href: '/desarrollo-de-software', label: 'Desarrollo de software' },
    { href: '/diagnostico', label: 'Agendar diagnóstico' },
  ],
};

export const footer = {
  rights: 'TI24',
  privacy: 'Aviso de privacidad',
  note: 'Sitio en construcción: versión preliminar para revisión.',
};
