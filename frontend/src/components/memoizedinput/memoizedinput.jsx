/*
 * IMPORTS
 */
import React from 'react' // Npm: react.js library.
import PropTypes from 'prop-types' // Npm: react.js library.
import { HiMagnifyingGlassCircle } from 'react-icons/hi2' // Npm: React icons.
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Select,
  Text
} from '@chakra-ui/react' // Npm: Chakra UI components.


/*
 * STYLES
 */
import './index.css'


/*
 * OBJECTS
 */
const MemoizedInputBase = React.forwardRef(({
  name,
  label,
  placeholder,
  containerStyle,
  type,
  data,
  value,
  color = '#2B3674',
  labelColor,
  bg = 'gray.100',
  onChange,
  error,
  icon,
  isRequired,
  isInvalid,
  disabled,
  isMultiple,
  useFormControl = false,
  ...props
}, ref) => {
  const controlledValue = value ?? data
  const shouldWrap = useFormControl || !!label || !!isMultiple || !!error

  if (!shouldWrap && !isMultiple) {
    return (
      <Input
        style={{ 'boxShadow': isInvalid ? '0 0 0 1.5px #EE5D50' : void 0, color, 'border': 'none' }}
        placeholder={placeholder}
        _placeholder={{ 'color': color ?? '#000' }}
        value={controlledValue}
        name={name}
        minH='30px'
        borderRadius='12px'
        onChange={onChange}
        type={type}
        bg={bg}
        disabled={disabled}
        {...props}
      />
    )
  }

  return (
    <Flex w='inherit' className='memoizedInput' direction='column'>
      <Flex w='inherit' style={containerStyle} direction='column'>
        <FormControl w='inherit' color={color} className={isInvalid ? 'inputInvalid' : disabled ? 'disabled' : void 0} isInvalid={isInvalid}>
        {
          label ? (
            <FormLabel color={labelColor}>
              {isRequired ? <Text display='flex' flexDirection='row'>{label}<Text color='red'>*</Text></Text> : <Text>{label}</Text>}
            </FormLabel>
          ) : void 0
        }
        {
          isMultiple ? (
            <Flex boxShadow={isInvalid ? '0 0 0 1.5px #EE5D50' : void 0} w='inherit' overflowY='auto' borderRadius='12px' opacity={disabled ? 0.5 : 1} bg={bg} color={color}>
              <Input
                style={{ 'boxShadow': isInvalid ? '0 0 0 1.5px #EE5D50' : void 0, color, 'border': 'none' }}
                placeholder={placeholder}
                _placeholder={{ 'color': color ?? '#000' }}
                value={Array.isArray(controlledValue) ? controlledValue.join(', ') : (controlledValue ?? '')}
                name={name}
                w='inherit'
                minH='30px'
                borderRadius='12px'
                onChange={(e) => {
                  const items = String(e.target.value || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                  onChange?.({ target: { name, value: items } })
                }}
                type='text'
                bg={bg}
                disabled={disabled}
                {...props}
              />
            </Flex>
          ) : (
            <Flex w='inherit' position='relative'>
              <Input
                style={{ 'boxShadow': isInvalid ? '0 0 0 1.5px #EE5D50' : void 0, color, 'border': 'none' }}
                placeholder={placeholder}
                _placeholder={{ 'color': color ?? '#000' }}
                value={controlledValue}
                name={name}
                w='inherit'
                minH='30px'
                borderRadius='12px'
                onChange={onChange}
                type={type}
                bg={bg}
                disabled={disabled}
                {...props}
              />
              {icon ? icon : void 0}
            </Flex>
          )
        }
        {isInvalid && error ? (<FormErrorMessage>{error}</FormErrorMessage>) : void 0}
      </FormControl>
    </Flex>
  </Flex>
  )
})
MemoizedInputBase.displayName = 'MemoizedInputBase'

const MemoizedSelectBase = React.forwardRef(({
  name,
  label,
  disabled,
  containerStyle,
  color = '#2B3674',
  error,
  bg = 'gray.100',
  placeholder,
  labelColor,
  icon,
  onChange,
  isInvalid,
  isRequired,
  data,
  value,
  options = [],
  children,
  useFormControl = false,
  ...props
}, ref) => {
  const controlledValue = value ?? data
  const shouldWrap = useFormControl || !!label || !!error

  const selectNode = (
    <Select
      className={isInvalid ? 'inputInvalid' : void 0}
      style={{ 'boxShadow': isInvalid ? '0 0 0 1.5px #EE5D50' : void 0, 'border': 'none' }}
      value={controlledValue}
      border='none'
      outline={0}
      minH='35px'
      placeholder={placeholder}
      name={name}
      w='inherit'
      p={0}
      borderRadius='12px'
      bg={isInvalid ? 'white' : bg}
      disabled={disabled}
      onChange={onChange}
      _placeholder={{ color }}
      color={color}
      _focus={{ 'borderColor': 'none' }}
      _hover={{ bg }}
      sx={{
        '&': {
          'fontSize': '15px',
          'color': '' === (controlledValue ?? '') ? 'black' : 'current'
        },
        "& option[value='']": { 'fontSize': '15px', 'color': 'black' },
        "& :not(option[value=''])": { 'fontSize': '15px', 'color': 'black' }
      }}
      {...props}>
      {children ? children : options.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          return (
            <option key={index} value={item.value}>
              {item.label}
            </option>
          )
        }
        return (
          <option key={index} value={item}>
            {item}
          </option>
        )
      })}
    </Select>
  )

  if (!shouldWrap) {
    return selectNode
  }

  return (
    <Flex w='inherit' alignItems='center' className='memoizedInput' style={containerStyle} direction='column' borderRadius={12}>
      <FormControl position='relative' w='inherit' isRequired={isRequired} isInvalid={isInvalid}>
        {label ? <FormLabel w='inherit' display='flex' color={labelColor}><Text fontWeight={500}>{label}</Text></FormLabel> : void 0}
        <Flex w='inherit' position='relative' key={controlledValue}>
          {selectNode}
          {icon ? icon : void 0}
        </Flex>
        {isInvalid && error ? (<FormErrorMessage>{error}</FormErrorMessage>) : void 0}
      </FormControl>
    </Flex>
  )
})
MemoizedSelectBase.displayName = 'MemoizedSelectBase'

const MemoizedSearchSelectBase = React.forwardRef(({
  name,
  label,
  disabled,
  containerStyle,
  color = '#2B3674',
  error,
  placeholder,
  labelColor,
  onChange,
  onSelect,
  isInvalid,
  iconColor,
  isRequired,
  data,
  bg = 'gray.100',
  options = [],
  ...props
}, ref) => {
  // Hook assignment.
  const [selectedOption, setSelectedOption] = React.useState('')
  const [search, setSearch] = React.useState([])
  const [value, setValue] = React.useState(data)
  const selectedOptionRef = React.useRef(null)

  const filterOptions = React.useCallback((items, term) => {
    const normalizedTerm = String(term ?? '').trim().toLowerCase()
    if (!normalizedTerm) return []

    return (items || []).filter((item) => String(item).toLowerCase().includes(normalizedTerm))
  }, [])

  // Event handler.
  React.useEffect(() => {
    // Clear selected option on data change.
    setSelectedOption('')
  }, [value])
  React.useEffect(() => {
    // Update if data is available.
    setValue(data)
  }, [data])
  React.useEffect(() => {
    // Recompute dropdown suggestions whenever async options or input value changes.
    setSearch(filterOptions(options, value))
  }, [options, value, filterOptions])
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedOptionRef.current && !selectedOptionRef.current.contains(event.target)) {
        setSearch([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Return component.
  return (
    <Flex w='inherit' className='memoizedInput' style={containerStyle} direction='column'>
      <FormControl w='inherit' isRequired={isRequired} color={color} isInvalid={isInvalid}>
        {label ? (<FormLabel w='inherit' color={labelColor}>{label}</FormLabel>) : void 0}
        <Flex w='inherit' position='relative' align='center'>
          <Input
            style={{ 'boxShadow': isInvalid ? '0 0 0 1.5px #EE5D50' : void 0, 'border': 'none' }}
            placeholder={placeholder}
            _placeholder={{ color }}
            defaultValue={selectedOption}
            name={name}
            bg={bg}
            pr='42px'
            minH='30px'
            w='inherit'
            borderRadius='12px'
            disabled={disabled}
            value={(selectedOption === null || selectedOption === undefined || selectedOption === '') ? value : selectedOption}
            onChange={i => {
              const inputValue = i.target.value

              // Update value.
              setValue(inputValue)

              // Update search.
              setSearch(filterOptions(options, inputValue))

              // Call the onChange function.
              onChange?.(i)
            }}
            {...props}
            zIndex={1000}
          />
          <Box position='absolute' right='12px' color={iconColor} zIndex={1000}>
            <HiMagnifyingGlassCircle size={22} />
          </Box>
        </Flex>
        {
          !(value === null || value === undefined || value === '') && 0 < search?.length ? (
            <Flex className='searchSelectDropDown' ref={selectedOptionRef} flexDir='column' mt={2}>
              {
                search?.map((item, index) => (
                  <Flex w='inherit' key={index} onClick={item.onClick}>
                    <Button
                      fontSize='md'
                      height='100%'
                      minH='40px'
                      fontWeight={500}
                      bg='transparent'
                      color='gray.600'
                      justifyContent='start'
                      w='inherit'
                      borderRadius={0}
                      onClick={() => {
                        // Update selected option.
                        setSelectedOption(item)

                        // Keep input value in sync with selected text.
                        setValue(item)

                        // Update value.
                        setSearch([])

                        // Call all change with updates.
                        onSelect?.({ 'target': { 'value': item, name } })
                      }}
                      _hover={{ 'bg': 'gray.100', 'color': 'gray.500' }}
                      _active={{ 'bg': 'gray.100' }}>
                      {item}
                    </Button>
                  </Flex>
                ))
              }
            </Flex>
          ) : void 0
        }
      </FormControl>
      {isInvalid && error ? (<FormErrorMessage>{error}</FormErrorMessage>) : void 0}
    </Flex>
  )
})
MemoizedSearchSelectBase.displayName = 'MemoizedSearchSelectBase'



/*
 * PROPTYPES
 */
MemoizedInputBase.propTypes = {
  'name': PropTypes.string,
  'label': PropTypes.string,
  'placeholder': PropTypes.string,
  'type': PropTypes.string,
  'data': PropTypes.any,
  'value': PropTypes.any,
  'onChange': PropTypes.func,
  'isInvalid': PropTypes.bool,
  'error': PropTypes.string,
  'isRequired': PropTypes.bool,
  'disabled': PropTypes.bool,
  'containerStyle': PropTypes.object,
  'color': PropTypes.string,
  'isMultiple': PropTypes.bool,
  'useFormControl': PropTypes.bool,
  'bg': PropTypes.string,
  'icon': PropTypes.any,
  'labelColor': PropTypes.string
}
MemoizedSearchSelectBase.propTypes = {
  'name': PropTypes.string,
  'label': PropTypes.string,
  'placeholder': PropTypes.string,
  'onChange': PropTypes.func,
  'onSelect': PropTypes.func,
  'isInvalid': PropTypes.bool,
  'data': PropTypes.any,
  'options': PropTypes.array,
  'props': PropTypes.object,
  'isRequired': PropTypes.bool,
  'disabled': PropTypes.bool,
  'iconColor': PropTypes.string,
  'containerStyle': PropTypes.object,
  'color': PropTypes.string,
  'error': PropTypes.string,
  'bg': PropTypes.string,
  'labelColor': PropTypes.string
}
MemoizedSelectBase.propTypes = {
  'name': PropTypes.string,
  'label': PropTypes.string,
  'placeholder': PropTypes.string,
  'onChange': PropTypes.func,
  'isInvalid': PropTypes.bool,
  'data': PropTypes.any,
  'value': PropTypes.any,
  'options': PropTypes.array,
  'children': PropTypes.node,
  'props': PropTypes.object,
  'isRequired': PropTypes.bool,
  'disabled': PropTypes.bool,
  'containerStyle': PropTypes.object,
  'color': PropTypes.string,
  'error': PropTypes.string,
  'bg': PropTypes.string,
  'icon': PropTypes.any,
  'labelColor': PropTypes.string
}


const MemoizedInput = React.memo(MemoizedInputBase)
const MemoizedSelect = React.memo(MemoizedSelectBase)
const MemoizedSearchSelect = React.memo(MemoizedSearchSelectBase)


/*
 * EXPORTS
 */
export { MemoizedInput, MemoizedSelect, MemoizedSearchSelect }