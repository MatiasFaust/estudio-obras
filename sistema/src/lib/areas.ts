// Elección del estudio (arquitectura o desarrollo). Archivo chico: lo usa también proxy.ts.

/** Pantalla para elegir el estudio después de ingresar (o al abrir la página en una pestaña nueva) */
export const CHOOSE_AREA = "/elegir";
/** Marca, por pestaña, que ya se eligió el estudio */
export const AREA_CHOSEN_KEY = "estudio-area-elegida";

export function markAreaChosen() {
  try {
    sessionStorage.setItem(AREA_CHOSEN_KEY, "1");
  } catch {
    /* sin almacenamiento: se vuelve a preguntar */
  }
}

export function areaChosen(): boolean {
  try {
    return sessionStorage.getItem(AREA_CHOSEN_KEY) === "1";
  } catch {
    return true;
  }
}
