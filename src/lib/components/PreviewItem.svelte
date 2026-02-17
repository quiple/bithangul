<script lang="ts">
  import { onMount } from 'svelte';

  export let index: number;
  export let data: ArrayBuffer | null;

  $: char = String.fromCharCode(0xAC00 + index);

  let canvas: HTMLCanvasElement;

  function draw() {
    if (!canvas || !data) {
        // Clear canvas if no data
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx?.clearRect(0, 0, canvas.width, canvas.height)
        }
        return
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Each char is 32 bytes (16 x uint16)
    // Offset = index * 32
    const offset = index * 32;
    if (offset + 32 > data.byteLength) return;

    const view = new DataView(data);

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black'; // Or variable color

    // Draw 16x16
    // Canvas size is 32x32 (scale 2)
    const scale = 2;

    for (let r = 0; r < 16; r++) {
       // Read Big Endian uint16
       const rowVal = view.getUint16(offset + r * 2, false);

       for (let c = 0; c < 16; c++) {
           // Check bit at c (MSB is index 0)
           // 0x8000 is bit 0 set.
           // (rowVal << c) & 0x8000 ?
           // Or (rowVal >> (15 - c)) & 1?
           if ((rowVal >> (15 - c)) & 1) {
               ctx.fillRect(c * scale, r * scale, scale, scale);
           }
       }
    }
  }

  $: if (canvas && data && index >= 0) draw();
</script>

<div class="flex items-center space-x-4 h-10 px-4 border-b">
  <div class="w-16 font-mono text-sm text-muted-foreground">U+{(0xAC00 + index).toString(16).toUpperCase()}</div>
  <div class="w-8 font-bold text-lg text-center border-r pr-4">{char}</div>
  <div class="flex-1">
     <canvas bind:this={canvas} width={32} height={32} class="border bg-white"></canvas>
  </div>
</div>
