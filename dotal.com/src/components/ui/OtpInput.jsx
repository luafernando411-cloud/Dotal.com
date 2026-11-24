import { useRef } from 'react'

export function OtpInput({ value, onChange, length = 4 }) {
  const inputs = useRef([])

  function setDigit(index, input) {
    const digit = input.replace(/\D/g, '').slice(-1)
    onChange(value.map((item, position) => position === index ? digit : item))
    if (digit && index < length - 1) inputs.current[index + 1]?.focus()
  }

  function pasteCode(event) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    event.preventDefault()
    onChange(digits.split('').concat(Array(length - digits.length).fill('')))
    inputs.current[Math.min(digits.length, length - 1)]?.focus()
  }

  return (
    <div className="otp-inputs" onPaste={pasteCode} data-testid="otp-input">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => { inputs.current[index] = element }}
          aria-label={`Dígito ${index + 1}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) inputs.current[index - 1]?.focus()
          }}
        />
      ))}
    </div>
  )
}
