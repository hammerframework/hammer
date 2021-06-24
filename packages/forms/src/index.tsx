import React, { useContext, forwardRef } from 'react'

import pascalcase from 'pascalcase'
import {
  useForm,
  FormProvider,
  useFormContext,
  RegisterOptions,
  UseFormMethods,
  UseFormOptions,
} from 'react-hook-form'

import {
  CoercionContextProvider,
  TDefinedCoercionFunctions,
  useCoercion,
} from './coercion'
import FormError from './FormError'

const DEFAULT_MESSAGES = {
  required: 'is required',
  pattern: 'is not formatted correctly',
  minLength: 'is too short',
  maxLength: 'is too long',
  min: 'is too low',
  max: 'is too high',
  validate: 'is not valid',
}

enum INPUT_TYPES {
  BUTTON = 'button',
  COLOR = 'color',
  DATE = 'date',
  DATETIME_LOCAL = 'datetime-local',
  EMAIL = 'email',
  FILE = 'file',
  HIDDEN = 'hidden',
  IMAGE = 'image',
  MONTH = 'month',
  NUMBER = 'number',
  PASSWORD = 'password',
  RADIO = 'radio',
  RANGE = 'range',
  RESET = 'reset',
  SEARCH = 'search',
  SUBMIT = 'submit',
  TEL = 'tel',
  TEXT = 'text',
  TIME = 'time',
  URL = 'url',
  WEEK = 'week',
}

// Massages a hash of props depending on whether the given named field has
// any errors on it

interface InputTagProps {
  name: string
  errorClassName?: string
  errorStyle?: React.CSSProperties
  transformValue?: ((value: string) => any) | TDefinedCoercionFunctions
  className?: string
  style?: React.CSSProperties
}

interface ValidatableFieldProps extends InputTagProps {
  validation?: RegisterOptions
  defaultValue?: string
}

const inputTagProps = <T extends InputTagProps>(
  props: T
): Omit<T, 'transformValue' | 'errorClassName' | 'errorStyle'> => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { errors, setError } = useFormContext()

  // Check for errors from server and set on field if present

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fieldErrorsContext = useContext(FieldErrorContext)
  const contextError = fieldErrorsContext[props.name]

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (contextError) {
      setError(props.name, { type: 'server', message: contextError })
    }
  }, [contextError, props.name, setError])

  // any errors on this field
  const validationError = errors[props.name]

  // get errorStyle/errorClassName and replace style/className if present
  // Also remove transformValue from tagProps
  const {
    errorClassName,
    errorStyle,
    transformValue, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...tagProps
  } = props
  if (validationError) {
    if (errorClassName) {
      tagProps.className = errorClassName
    }
    if (errorStyle) {
      tagProps.style = errorStyle
    }
  }

  return tagProps
}

// Context for keeping track of errors from the server
interface FieldErrorContextProps {
  [key: string]: string
}
const FieldErrorContext = React.createContext({} as FieldErrorContextProps)

const coerceValues = (
  data: Record<string, string>,
  coerce: (name: string, value: string) => any
) => {
  const coercedData: Record<string, any> = {}

  Object.keys(data).forEach((name) => {
    coercedData[name] = coerce(name, data[name])
  })

  return coercedData
}

interface FormWithCoercionContext
  extends Omit<React.HTMLProps<HTMLFormElement>, 'onSubmit'> {
  error?: any
  formMethods?: UseFormMethods
  validation?: UseFormOptions
  onSubmit?: (
    values: Record<string, any>,
    event?: React.BaseSyntheticEvent
  ) => void
}

const FormWithCoercionContext: React.FC<FormWithCoercionContext> = (props) => {
  // deconstruct some props we care about and keep the remaining `formProps` to
  // pass to the <form> tag
  const {
    error: errorProps,
    formMethods: propFormMethods,
    onSubmit,
    ...formProps
  } = props
  const useFormMethods = useForm(props.validation)
  const formMethods = propFormMethods || useFormMethods
  const { coerce } = useCoercion()

  return (
    <form
      {...formProps}
      onSubmit={formMethods.handleSubmit((data, event) =>
        onSubmit?.(coerceValues(data, coerce), event)
      )}
    >
      <FieldErrorContext.Provider
        value={
          errorProps?.graphQLErrors[0]?.extensions?.exception?.messages || {}
        }
      >
        <FormProvider {...formMethods}>{props.children}</FormProvider>
      </FieldErrorContext.Provider>
    </form>
  )
}

// Renders a containing <form> tag with required contexts

const Form: React.FC<FormWithCoercionContext> = (props) => {
  return (
    <CoercionContextProvider>
      <FormWithCoercionContext {...props} />
    </CoercionContextProvider>
  )
}

// Renders a <label> tag that can be styled differently if errors are present
// on the related fields

interface LabelProps {
  name: string
  errorClassName?: string
  errorStyle?: React.CSSProperties
}

const Label: React.FC<
  LabelProps & React.LabelHTMLAttributes<HTMLLabelElement>
> = (props) => {
  const tagProps = inputTagProps(props)

  return (
    <label htmlFor={props.name} {...tagProps}>
      {props.children || props.name}
    </label>
  )
}

// Renders a <span> with a validation error message if there is an error on this
// field

interface FieldErrorProps extends React.HTMLProps<HTMLSpanElement> {
  name: string
}

const FieldError = (props: FieldErrorProps) => {
  const { errors } = useFormContext()
  const validationError = errors[props.name]
  const errorMessage =
    validationError &&
    (validationError.message ||
      `${props.name} ${
        DEFAULT_MESSAGES[validationError.type as keyof typeof DEFAULT_MESSAGES]
      }`)

  return validationError ? <span {...props}>{errorMessage}</span> : null
}

const jsonValidation = (value: string) => {
  try {
    JSON.parse(value)
  } catch (e) {
    return e.message
  }
}

// Renders a <textarea> field

const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  ValidatableFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  const { register } = useFormContext()
  const { setCoercion } = useCoercion()

  React.useEffect(() => {
    setCoercion({
      name: props.name,
      transformValue: props.transformValue,
    })
  }, [setCoercion, props.name, props.transformValue])

  const tagProps = inputTagProps(props)
  // implements JSON validation if a transformValue of 'Json' is set
  const validation = props.validation ? props.validation : { required: false }
  if (!validation.validate && props.transformValue === 'Json') {
    validation.validate = jsonValidation
  }

  return (
    <textarea
      {...tagProps}
      id={props.id || props.name}
      ref={(element) => {
        register(element, validation)

        if (typeof ref === 'function') {
          ref(element)
        } else if (ref) {
          ref.current = element
        }
      }}
    />
  )
})

// Renders a <select> field

const SelectField = forwardRef<
  HTMLSelectElement,
  ValidatableFieldProps & React.SelectHTMLAttributes<HTMLSelectElement>
>((props, ref) => {
  const { register } = useFormContext()
  const { setCoercion } = useCoercion()

  React.useEffect(() => {
    setCoercion({
      name: props.name,
      transformValue: props.transformValue,
    })
  }, [setCoercion, props.name, props.transformValue])

  const tagProps = inputTagProps(props)

  return (
    <select
      {...tagProps}
      id={props.id || props.name}
      ref={(element) => {
        register(element, props.validation || { required: false })

        if (typeof ref === 'function') {
          ref(element)
        } else if (ref) {
          ref.current = element
        }
      }}
    />
  )
})

// Renders a <input type="checkbox"> field

interface CheckboxFieldProps
  extends Omit<ValidatableFieldProps, 'defaultValue'> {
  defaultChecked?: boolean
}

export const CheckboxField = forwardRef<
  HTMLInputElement,
  CheckboxFieldProps & React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => {
  const { register } = useFormContext()
  const { setCoercion } = useCoercion()
  const type = 'checkbox'

  React.useEffect(() => {
    setCoercion({
      name: props.name,
      type,
      transformValue: props.transformValue,
    })
  }, [setCoercion, props.name, type, props.transformValue])

  const tagProps = inputTagProps(props)

  return (
    <input
      type="checkbox"
      {...tagProps}
      id={props.id || props.name}
      ref={(element) => {
        register(element, props.validation || { required: false })

        if (typeof ref === 'function') {
          ref(element)
        } else if (ref) {
          ref.current = element
        }
      }}
    />
  )
})

// Renders a <button type="submit">

const Submit = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>((props, ref) => <button ref={ref} type="submit" {...props} />)

// Renders a <input>

interface InputFieldProps extends ValidatableFieldProps {
  type?: INPUT_TYPES
}

const InputField = forwardRef<
  HTMLInputElement,
  InputFieldProps & React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => {
  const { register } = useFormContext()
  const { setCoercion } = useCoercion()
  React.useEffect(() => {
    setCoercion({
      name: props.name,
      type: props.type,
      transformValue: props.transformValue,
    })
  }, [setCoercion, props.name, props.type, props.transformValue])

  const tagProps = inputTagProps(props)

  return (
    <input
      {...tagProps}
      id={props.id || props.name}
      ref={(element) => {
        register(element, props.validation || { required: false })

        if (typeof ref === 'function') {
          ref(element)
        } else if (ref) {
          ref.current = element
        }
      }}
    />
  )
})

// Create a component for each type of Input.
//
// Uses a bit of Javascript metaprogramming to create the functions with a dynamic
// name rather than having to write out each and every component definition. In
// simple terms it creates an object with the key being the current value of `type`
// and then immediately returns the value, which is the component function definition.
//
// In the end we end up with `inputComponents.TextField` and all the others. Export those
// and we're good to go.

const inputComponents: Record<
  string,
  React.ForwardRefExoticComponent<
    InputFieldProps &
      React.InputHTMLAttributes<HTMLInputElement> &
      React.RefAttributes<HTMLInputElement>
  >
> = {}
Object.values(INPUT_TYPES).forEach((type) => {
  inputComponents[`${pascalcase(type)}Field`] = forwardRef<
    HTMLInputElement,
    InputFieldProps & React.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <InputField ref={ref} type={type} {...props} />)
})

export {
  Form,
  FieldErrorContext,
  FormError,
  FieldError,
  InputField,
  Label,
  TextAreaField,
  SelectField,
  Submit,
}

export const {
  ButtonField,
  ColorField,
  DateField,
  DatetimeLocalField,
  EmailField,
  FileField,
  HiddenField,
  ImageField,
  MonthField,
  NumberField,
  PasswordField,
  RadioField,
  RangeField,
  ResetField,
  SearchField,
  SubmitField,
  TelField,
  TextField,
  TimeField,
  UrlField,
  WeekField,
} = inputComponents
