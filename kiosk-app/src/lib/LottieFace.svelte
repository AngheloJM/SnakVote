<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { AnimationItem } from "lottie-web";
  import { buildFaceAnimation } from "./lottieFace";
  import type { Mood } from "./mood";

  let { mood, size = 64, delay = 0 }: { mood: Mood; size?: number; delay?: number } = $props();

  let container: HTMLDivElement;
  let anim: AnimationItem | undefined;

  onMount(() => {
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled) return;
      anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: false,
        animationData: buildFaceAnimation(mood),
      });
      setTimeout(() => anim?.play(), delay * 1000);
    });

    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    anim?.destroy();
  });
</script>

<div bind:this={container} class="lottie-face" style="width: {size}px; height: {size}px"></div>

<style>
  .lottie-face {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
