/**
 * Imagen de fondo del panel de acceso — foto real de proyectos renovables
 * (public/fondo.png), no la ilustración SVG anterior. Se mantiene el texto de
 * marca abajo con un degradado oscuro superpuesto para que sea legible sobre
 * la foto.
 */
export function EnergyVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08261d]">
      {/* La imagen se dibuja al 125% de alto anclada arriba, así el 20% inferior
          queda siempre fuera del recuadro visible, sin importar el aspecto de
          la ventana. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fondo.png"
        alt="Proyectos de energía renovable en Latinoamérica"
        className="absolute inset-x-0 top-0 h-[125%] w-full object-cover object-top"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end p-10 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200 uppercase">Transition LATAM</p>
        <p className="mt-2 max-w-xs text-sm text-emerald-50/80">
          Inteligencia de mercado sobre la transición energética en Chile — proyectos, capacidad y pipeline en un
          solo lugar.
        </p>
      </div>
    </div>
  );
}
