<script lang="ts">
  import type { Mood } from "./mood";
  export type { Mood };

  const MOUTHS: Record<Mood, string> = {
    muy_satisfecho: "M 20 62 Q 50 92 80 62",
    satisfecho: "M 24 60 Q 50 78 76 60",
    regular: "M 26 66 L 74 66",
    poco_satisfecho: "M 24 78 Q 50 62 76 78",
    insatisfecho: "M 18 84 Q 50 56 82 84",
  };

  // Paleta NOVA: verde éxito -> naranja de marca -> rojo error.
  const COLORS: Record<Mood, string> = {
    muy_satisfecho: "#16A344",
    satisfecho: "#6FCB8B",
    regular: "#F59E0B",
    poco_satisfecho: "#E47704",
    insatisfecho: "#EF4444",
  };

  let {
    mood,
    size = 64,
    delay = 0,
    selected = false,
  }: { mood: Mood; size?: number; delay?: number; selected?: boolean } = $props();
</script>

<svg
  class="face"
  class:selected
  style="animation-delay: {delay}s; width: {size}px; height: {size}px"
  viewBox="0 0 100 100"
  aria-hidden="true"
>
  <circle cx="50" cy="50" r="46" fill={COLORS[mood]} />
  <g class="eyes">
    <circle cx="34" cy="42" r="6" fill="#101828" />
    <circle cx="66" cy="42" r="6" fill="#101828" />
  </g>
  <path d={MOUTHS[mood]} stroke="#101828" stroke-width="6" fill="none" stroke-linecap="round" />
</svg>

<style>
  .face {
    display: inline-block;
    flex-shrink: 0;
    animation: idleBounce 2.4s ease-in-out infinite;
  }

  .face.selected {
    animation: facePop 0.35s ease;
  }

  .eyes {
    transform-origin: 50px 42px;
    animation: blink 4.5s ease-in-out infinite;
  }

  @keyframes idleBounce {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-5px) rotate(-6deg); }
  }

  @keyframes facePop {
    0% { transform: scale(1) rotate(0deg); }
    45% { transform: scale(1.35) rotate(-8deg); }
    100% { transform: scale(1.1) rotate(0deg); }
  }

  @keyframes blink {
    0%, 92%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.1); }
  }
</style>
