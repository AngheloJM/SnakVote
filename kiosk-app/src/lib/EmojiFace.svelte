<script lang="ts">
  import type { Mood } from "./mood";

  let { mood, size = 64, delay = 0 }: { mood: Mood; size?: number; delay?: number } = $props();
</script>

<img
  class="emoji-face"
  style="width: {size}px; height: {size}px; animation-delay: {delay}s"
  src="/emoji/{mood}.png"
  alt=""
  aria-hidden="true"
/>

<style>
  .emoji-face {
    display: inline-block;
    flex-shrink: 0;
    animation: idleBounce 2.4s ease-in-out infinite;
  }

  @keyframes idleBounce {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-5px) rotate(-6deg); }
  }
</style>
