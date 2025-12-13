'use client'

import { useState, useEffect } from 'react'
import {
  parsePhoneNumber,
  CountryCode,
  getCountries,
  getCountryCallingCode
} from 'libphonenumber-js'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  defaultCountry?: CountryCode
  className?: string
  disabled?: boolean
}

// Country flag emoji function
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// Priority countries at the top of the list
const priorityCountries: CountryCode[] = ['KZ', 'RU', 'UZ', 'TJ', 'KG', 'AZ', 'TR', 'US', 'GB']

export function PhoneInput({
  value = '',
  onChange,
  defaultCountry = 'KZ',
  className,
  disabled = false,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry)
  const [nationalNumber, setNationalNumber] = useState('')

  // Parse initial value
  useEffect(() => {
    if (value && value.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(value)
        if (parsed && parsed.country) {
          setCountry(parsed.country)
          setNationalNumber(parsed.nationalNumber)
        }
      } catch {
        // Invalid number, keep defaults
      }
    }
  }, [])

  // Build full number on change
  useEffect(() => {
    if (nationalNumber) {
      const callingCode = getCountryCallingCode(country)
      const fullNumber = `+${callingCode}${nationalNumber.replace(/\D/g, '')}`
      onChange?.(fullNumber)
    } else {
      onChange?.('')
    }
  }, [country, nationalNumber, onChange])

  const countries = getCountries()
  const sortedCountries = [
    ...priorityCountries.filter(c => countries.includes(c)),
    ...countries.filter(c => !priorityCountries.includes(c))
  ]

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={country}
        onValueChange={(v) => setCountry(v as CountryCode)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue>
            {getFlagEmoji(country)} +{getCountryCallingCode(country)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {sortedCountries.map((code) => (
            <SelectItem key={code} value={code}>
              {getFlagEmoji(code)} {code} +{getCountryCallingCode(code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="tel"
        value={nationalNumber}
        onChange={(e) => setNationalNumber(e.target.value)}
        placeholder="Номер телефона"
        className="flex-1"
        disabled={disabled}
      />
    </div>
  )
}
