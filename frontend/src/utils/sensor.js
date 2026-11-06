// BR-129: ngưỡng an toàn của ô theo loại kho — "15–30°C, độ ẩm ≤ 75%" / "-25 → -15°C, độ ẩm ≤ 95%"
export function sensorRange(sensor) {
  if (!sensor || sensor.tempMin == null || sensor.tempMax == null) return ''
  const min = Number(sensor.tempMin)
  const max = Number(sensor.tempMax)
  const range = min < 0 ? `${min} → ${max}` : `${min}–${max}`
  return `${range}°C, độ ẩm ≤ ${Number(sensor.humidityMax)}%`
}
