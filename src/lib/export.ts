/**
 * 문자열을 파일로 다운로드
 */
export function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], {type: `${mimeType};charset=utf-8`})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 브라우저가 다운로드를 시작할 시간을 확보한 후 URL 해제
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
