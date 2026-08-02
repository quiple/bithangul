<script lang="ts">
  import '#app.css'
  import appleTouchIcon from '$lib/assets/apple-touch-icon.png'
  import favicon32 from '$lib/assets/favicon.png'
  import favicon from '$lib/assets/favicon.svg'
  import {projectState} from '$lib/state.svelte'

  let {children} = $props()

  $effect(() => {
    const isDirty = projectState.project.components.length > 0

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })
</script>

<svelte:head>
  <title>BitHangul</title>
  <meta property="og:title" content="BitHangul" />
  <meta property="og:site_name" content="BitHangul" />
  <meta
    name="description"
    content="비트맵 한글 폰트 제작 도구. 자모 컴포넌트를 조합하여 한글 음절 11,172자를 생성합니다."
  />
  <meta
    property="og:description"
    content="비트맵 한글 폰트 제작 도구. 자모 컴포넌트를 조합하여 한글 음절 11,172자를 생성합니다."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://bithangul.quiple.dev" />
  <link rel="canonical" href="https://bithangul.quiple.dev" />
  <meta property="og:locale" content="ko_KR" />
  <link rel="icon" type="image/png" sizes="32x32" href={favicon32} />
  <link rel="icon" type="image/svg+xml" sizes="any" href={favicon} />
  <link rel="apple-touch-icon" type="image/png" href={appleTouchIcon} />
</svelte:head>

{@render children()}
