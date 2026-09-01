// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React, { createContext, useContext } from "react"
import { FormProvider, UseFormReturn } from "react-hook-form"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OrderBalanceSettlementForm } from "./order-balance-settlement-form"

class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

vi.stubGlobal("ResizeObserver", MockResizeObserver)

const mocks = vi.hoisted(() => ({
  createCreditLine: vi.fn(),
  createRefund: vi.fn(),
  handleSuccess: vi.fn(),
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("../../../../../hooks/api", () => ({
  useCreateOrderCreditLine: () => ({
    mutateAsync: mocks.createCreditLine,
    isPending: false,
  }),
  useRefundPayment: () => ({
    mutateAsync: mocks.createRefund,
    isPending: false,
  }),
  useRefundReasons: () => ({
    refund_reasons: [
      {
        id: "refund_reason_damaged",
        label: "Damaged item",
      },
    ],
  }),
}))

vi.mock("../../../../../hooks/use-document-direction", () => ({
  useDocumentDirection: () => "ltr",
}))

vi.mock("../../../../../components/modals", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => children
  const Form = ({
    form,
    children,
  }: {
    form: UseFormReturn<any>
    children: React.ReactNode
  }) => <FormProvider {...form}>{children}</FormProvider>

  return {
    RouteDrawer: {
      Form,
      Body: Wrapper,
      Footer: Wrapper,
      Close: Wrapper,
    },
    useRouteModal: () => ({ handleSuccess: mocks.handleSuccess }),
  }
})

vi.mock("@medusajs/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medusajs/ui")>()
  const SelectContext = createContext<((value: string) => void) | undefined>(
    undefined
  )

  const Root = ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <SelectContext.Provider value={onValueChange}>
      <div>{children}</div>
    </SelectContext.Provider>
  )

  const Wrapper = ({ children }: { children?: React.ReactNode }) => children
  const Value = ({ placeholder }: { placeholder?: React.ReactNode }) => (
    <span>{placeholder}</span>
  )
  const Item = ({
    children,
    disabled,
    value,
  }: {
    children: React.ReactNode
    disabled?: boolean
    value: string
  }) => {
    const onValueChange = useContext(SelectContext)

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onValueChange?.(value)}
      >
        {children}
      </button>
    )
  }

  const Select = Object.assign(Root, {
    Trigger: Wrapper,
    Value,
    Content: Wrapper,
    Item,
  })

  return { ...actual, Select }
})

const order = {
  id: "order_1",
  currency_code: "usd",
  summary: {
    pending_difference: -1000,
  },
  payment_collections: [
    {
      id: "pay_col_1",
      payments: [
        {
          id: "pay_1",
          amount: 1000,
          currency_code: "usd",
          provider_id: "pp_system_default",
          refunds: [],
        },
      ],
    },
  ],
} as any

describe("OrderBalanceSettlementForm", () => {
  beforeEach(() => {
    mocks.createRefund.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("includes the selected refund reason when settling with a refund", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/?paymentId=pay_1"]}>
        <OrderBalanceSettlementForm order={order} />
      </MemoryRouter>
    )

    expect(screen.getByText("fields.refundReason")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Damaged item" }))
    await user.click(screen.getByRole("button", { name: "actions.save" }))

    await waitFor(() => {
      expect(mocks.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          refund_reason_id: "refund_reason_damaged",
        }),
        expect.objectContaining({
          onError: expect.any(Function),
          onSuccess: expect.any(Function),
        })
      )
    })
  })
})
