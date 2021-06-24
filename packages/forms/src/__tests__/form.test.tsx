import React from 'react'

import { toHaveFocus } from '@testing-library/jest-dom/matchers'
import {
  screen,
  render,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
expect.extend({ toHaveFocus })

import {
  Form,
  TextField,
  NumberField,
  CheckboxField,
  TextAreaField,
  DatetimeLocalField,
  DateField,
  SelectField,
  Submit,
} from '../index'

describe('Form', () => {
  const TestComponent = ({ onSubmit = () => {} }) => {
    return (
      <Form onSubmit={onSubmit}>
        <TextField name="text" defaultValue="text" />
        <NumberField name="number" defaultValue="42" />
        <TextField
          name="floatText"
          defaultValue="3.14"
          transformValue="Float"
        />
        <CheckboxField name="checkbox" defaultChecked={true} />
        <TextAreaField
          name="json"
          transformValue="Json"
          defaultValue={`
            {
              "key_one": "value1",
              "key_two": 2,
              "false": false
            }
          `}
        />
        <DatetimeLocalField
          name="datetimeLocal"
          defaultValue="2021-04-16T12:34"
        />
        <DateField name="date" defaultValue="2021-04-16" />
        <SelectField name="select1" data-testid="select1">
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </SelectField>
        <SelectField name="select2" data-testid="select2" transformValue="Int">
          <option value={1}>Option 1</option>
          <option value={2}>Option 2</option>
          <option value={3}>Option 3</option>
        </SelectField>

        <Submit>Save</Submit>
      </Form>
    )
  }

  const NumberFieldsWrapper = () => (
    <div>
      <h4>This is a wrapped form field header</h4>
      <div>
        <label htmlFor="wrapped-nf-1">Wrapped NumberField</label>
        <NumberField name="wrapped-nf-1" defaultValue="0101" />
      </div>
      <div>
        <label htmlFor="wrapped-nf-2">Wrapped NumberField</label>
        <NumberField name="wrapped-nf-2" defaultValue="0102" />
      </div>
    </div>
  )

  const TestComponentWithWrappedFormElements = ({ onSubmit = () => {} }) => {
    return (
      <Form onSubmit={onSubmit}>
        <p>Some text</p>
        <div className="field">
          <TextField
            name="wrapped-ff"
            defaultValue="3.14"
            transformValue="Float"
          />
        </div>
        <NumberFieldsWrapper />
        <Submit>Save</Submit>
      </Form>
    )
  }

  const TestComponentWithRef = () => {
    const inputEl = React.useRef(null)
    React.useEffect(() => {
      inputEl.current.focus()
    })
    return (
      <Form>
        <TextField name="tf" defaultValue="text" ref={inputEl} />
      </Form>
    )
  }

  afterEach(() => {
    cleanup()
  })

  it('does not crash', () => {
    expect(() => render(<TestComponent />)).not.toThrow()
  })

  it('calls onSubmit', async () => {
    const mockFn = jest.fn()

    render(<TestComponent onSubmit={mockFn} />)

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
  })

  it('renders and coerces user-supplied values', async () => {
    const mockFn = jest.fn()

    render(<TestComponent onSubmit={mockFn} />)

    userEvent.type(screen.getByDisplayValue('text'), 'text')
    userEvent.type(screen.getByDisplayValue('42'), '24')
    userEvent.type(screen.getByDisplayValue('3.14'), '1592')
    fireEvent.change(screen.getByTestId('select1'), {
      target: { value: 'Option 2' },
    })
    fireEvent.change(screen.getByTestId('select2'), {
      target: { value: 3 },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      {
        text: 'texttext',
        number: 4224, // i.e. NOT "4224"
        floatText: 3.141592,
        select1: 'Option 2',
        select2: 3,
        checkbox: true,
        json: {
          key_one: 'value1',
          key_two: 2,
          false: false,
        },
        datetimeLocal: new Date('2021-04-16T12:34').toISOString(),
        date: new Date('2021-04-16').toISOString(),
      },
      expect.anything() // event that triggered the onSubmit call
    )
  })

  it('finds nested form fields to coerce', async () => {
    const mockFn = jest.fn()

    render(<TestComponentWithWrappedFormElements onSubmit={mockFn} />)

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      { 'wrapped-ff': 3.14, 'wrapped-nf-1': 101, 'wrapped-nf-2': 102 },
      expect.anything() // event that triggered the onSubmit call
    )
  })

  it('supports ref forwarding', async () => {
    render(<TestComponentWithRef />)
    const input = screen.getByDisplayValue('text')

    await waitFor(() => {
      expect(input).toHaveFocus()
    })
  })

  it('lets users pass custom coercion functions', async () => {
    const mockFn = jest.fn()
    const coercionFunctionNumber = (value) =>
      parseInt(value.replace('_', ''), 10)
    const coercionFunctionText = (value) => value.replace('_', '-')

    render(
      <Form onSubmit={mockFn}>
        <TextField
          name="tf"
          defaultValue="123_456"
          transformValue={coercionFunctionNumber}
        />
        <SelectField
          name="select"
          defaultValue="Option_2"
          transformValue={coercionFunctionText}
        >
          <option>Option_1</option>
          <option>Option_2</option>
        </SelectField>
        <Submit>Save</Submit>
      </Form>
    )

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      { tf: 123456, select: 'Option-2' },
      expect.anything() // event that triggered the onSubmit call
    )
  })

  it('handles int and float blank values gracefully with console warnings', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const mockFn = jest.fn()

    render(
      <Form onSubmit={mockFn}>
        <NumberField name="int" defaultValue="" transformValue="Int" />
        <TextField name="float" defaultValue="" transformValue="Float" />
        <Submit>Save</Submit>
      </Form>
    )
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      {
        int: undefined,
        float: undefined,
      },
      expect.anything() // event that triggered the onSubmit call
    )
    spy.mockRestore()
  })

  it('handles datetime blank values gracefully with console warnings', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const mockFn = jest.fn()

    render(
      <Form onSubmit={mockFn}>
        <DateField name="date" defaultValue="" />
        <DatetimeLocalField name="datetime" defaultValue="" />
        <Submit>Save</Submit>
      </Form>
    )
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      {
        date: undefined,
        datetime: undefined,
      },
      expect.anything() // event that triggered the onSubmit call
    )
    spy.mockRestore()
  })

  it('input fields issue a console.warn if an invalid transformValue is set', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => {})

    render(
      <Form>
        {/*@ts-expect-error transformValue only accepts specific arguments*/}
        <TextAreaField name="taf" defaultValue="" transformValue="BAD" />
      </Form>
    )

    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(1))
    expect(console.warn).toBeCalledWith(
      'Form input taf does not have a valid transformValue'
    )
    spy.mockRestore()
  })

  // Note the good JSON case is tested in an earlier test
  it('for a TextAreaField with transformValue set to "Json", it automatically sets JSON validation.  Bad JSON case', async () => {
    const mockFn = jest.fn()

    render(
      <Form onSubmit={mockFn}>
        <TextAreaField
          name="jsonField"
          defaultValue="{bad-json}"
          data-testid="jsonField"
          transformValue="Json"
        />
        <Submit>Save</Submit>
      </Form>
    )
    fireEvent.click(screen.getByText('Save'))
    // The validation should catch and prevent the onSubmit from being called
    await waitFor(async () => {
      await new Promise((res) =>
        setTimeout(() => {
          res(1)
        }, 50)
      )
      expect(mockFn).not.toHaveBeenCalled()
    })
  })

  it('for a TextAreaField with transformValue set to "Json", and a validation function custom set, it warns the developer upon a bad JSON submission', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => {})
    const mockFn = jest.fn()

    render(
      <Form onSubmit={mockFn}>
        <TextAreaField
          name="jsonField"
          defaultValue="{bad-json}"
          data-testid="jsonField"
          transformValue="Json"
          validation={{ validate: (value: string) => value && null }}
        />
        <Submit>Save</Submit>
      </Form>
    )
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(1))
    expect(console.warn).toBeCalledWith(
      "Invalid Json. Form field validation not set.  Returning 'undefined' instead of '{bad-json}'"
    )
    await waitFor(() => expect(mockFn).toHaveBeenCalledTimes(1))
    expect(mockFn).toBeCalledWith(
      {
        jsonField: undefined,
      },
      expect.anything() // event that triggered the onSubmit call
    )

    spy.mockRestore()
  })
})
