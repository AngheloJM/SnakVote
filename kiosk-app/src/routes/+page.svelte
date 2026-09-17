<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";

  const KIOSK_ID = "kiosko-1"; // TODO: leer de configuración por dispositivo

  type SatisfactionKey =
    | "muy_satisfecho"
    | "satisfecho"
    | "regular"
    | "poco_satisfecho"
    | "insatisfecho";

  const SATISFACTION_LEVELS: { key: SatisfactionKey; emoji: string; label: string }[] = [
    { key: "muy_satisfecho", emoji: "😊", label: "Muy satisfecho" },
    { key: "satisfecho", emoji: "🙂", label: "Satisfecho" },
    { key: "regular", emoji: "😐", label: "Regular" },
    { key: "poco_satisfecho", emoji: "🙁", label: "Poco satisfecho" },
    { key: "insatisfecho", emoji: "😞", label: "Insatisfecho" },
  ];

  const QUICK_COMMENTS: Record<SatisfactionKey, string[]> = {
    muy_satisfecho: ["Atención rápida", "Muy amable", "Buena comida", "Buena presentación", "Todo excelente"],
    satisfecho: ["Buena atención", "Trato amable", "Comida rica", "Buena variedad", "Cumplió lo esperado"],
    regular: ["Atención normal", "Comida aceptable", "Podría mejorar", "Espera normal", "Sin comentarios"],
    poco_satisfecho: ["Atención algo lenta", "Trato regular", "Comida sin sabor", "Variedad limitada", "Presentación simple"],
    insatisfecho: ["Atención lenta", "Trato descortés", "Comida fría", "Poca variedad", "Mala presentación"],
  };

  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;
  let cameraReady = $state(false);
  let cameraError = $state("");
  let step = $state<"satisfaction" | "comment" | "sending" | "done">("satisfaction");
  let chosen = $state<SatisfactionKey | null>(null);
  let flashKey = $state<string | null>(null);

  onMount(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      videoEl.srcObject = stream;
      cameraReady = true;
    } catch (err) {
      cameraError = "No se pudo acceder a la cámara. Verifica los permisos.";
      console.error(err);
    }
  });

  function capturePhotoBase64(): string {
    const ctx = canvasEl.getContext("2d")!;
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);
    const dataUrl = canvasEl.toDataURL("image/jpeg", 0.85);
    return dataUrl.split(",")[1];
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function chooseSatisfaction(satisfaction: SatisfactionKey) {
    if (!cameraReady || flashKey) return;
    flashKey = satisfaction;
    await wait(280);
    chosen = satisfaction;
    step = "comment";
    flashKey = null;
  }

  async function chooseComment(comment: string) {
    if (!chosen || flashKey) return;
    flashKey = comment;
    await wait(280);
    step = "sending";

    const photoBase64 = capturePhotoBase64();

    try {
      await invoke("cast_vote", {
        kioskId: KIOSK_ID,
        satisfaction: chosen,
        quickComment: comment,
        photoBase64,
      });
      step = "done";
      setTimeout(() => {
        step = "satisfaction";
        chosen = null;
        flashKey = null;
      }, 2500);
    } catch (err) {
      console.error(err);
      step = "comment";
      flashKey = null;
    }
  }
</script>

<div class="page">
  <video bind:this={videoEl} autoplay muted playsinline class="hidden-video"></video>
  <canvas bind:this={canvasEl} class="hidden-video"></canvas>

  <div class="card">
    {#if step === "done"}
      <div class="center-content" in:scale={{ start: 0.85, duration: 350 }}>
        <p class="big-emoji">🙏</p>
        <p class="thanks-text">¡Gracias por tu opinión!</p>
      </div>
    {:else if step === "sending"}
      <div class="center-content" in:fade={{ duration: 200 }}>
        <p class="big-emoji spin">📸</p>
        <p class="thanks-text">Enviando...</p>
      </div>
    {:else if step === "comment" && chosen}
      <div in:fly={{ x: 40, duration: 250 }}>
        <div class="progress">Paso 2 de 2</div>
        <h1>¿Por qué?</h1>
        <div class="option-list">
          {#each QUICK_COMMENTS[chosen] as comment}
            <button
              class="option-row"
              class:selected={flashKey === comment}
              onclick={() => chooseComment(comment)}
            >
              {comment}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div in:fly={{ x: -40, duration: 250 }}>
        <div class="progress">Paso 1 de 2</div>
        <h1>¿Cómo fue tu experiencia hoy?</h1>

        {#if cameraError}
          <p class="error">{cameraError}</p>
        {/if}

        <div class="option-list">
          {#each SATISFACTION_LEVELS as level}
            <button
              class="option-row"
              class:selected={flashKey === level.key}
              disabled={!cameraReady}
              onclick={() => chooseSatisfaction(level.key)}
            >
              <span class="row-emoji">{level.emoji}</span>
              <span>{level.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

  .page {
    height: 100dvh;
    width: 100dvw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #0f172a, #111827 60%);
    padding: clamp(1rem, 4vw, 2rem);
    box-sizing: border-box;
    font-family: system-ui, sans-serif;
  }

  .card {
    background: white;
    border-radius: 1.75rem;
    box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.5);
    width: min(94vw, 30rem);
    max-height: 92dvh;
    overflow-y: auto;
    padding: clamp(1.5rem, 4vw, 2.5rem);
    box-sizing: border-box;
    color: #0f172a;
  }

  .progress {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: clamp(1.3rem, 4vw, 1.75rem);
    margin: 0 0 1.5rem;
    text-align: left;
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    text-align: left;
    padding: 1.1rem 1.25rem;
    border-radius: 1rem;
    border: 2px solid #e5e7eb;
    background: #f9fafb;
    font-size: clamp(1rem, 2.2vw, 1.15rem);
    color: #1f2937;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
  }

  .option-row:hover:not(:disabled) {
    border-color: #c7d2fe;
    background: #f5f6ff;
  }

  .option-row:active:not(:disabled) {
    transform: scale(0.98);
  }

  .option-row.selected {
    background: #eef2ff;
    border-color: #6366f1;
    transform: scale(0.98);
  }

  .option-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .row-emoji {
    font-size: 1.6rem;
    line-height: 1;
  }

  .error {
    color: #b45309;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .center-content {
    text-align: center;
    padding: 2rem 0;
  }

  .big-emoji {
    font-size: 4rem;
    margin: 0 0 1rem;
  }

  .big-emoji.spin {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  .thanks-text {
    font-size: 1.4rem;
    font-weight: 600;
    margin: 0;
  }

  .hidden-video {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
</style>
