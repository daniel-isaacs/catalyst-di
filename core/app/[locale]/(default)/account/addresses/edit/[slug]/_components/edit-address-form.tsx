'use client';

import { AlertCircle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MouseEvent, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'react-hot-toast';

import {
  Checkboxes,
  createFieldName,
  DateField,
  FieldNameToFieldId,
  FieldWrapper,
  getPreviouslySubmittedValue,
  MultilineText,
  NumbersOnly,
  Password,
  Picklist,
  PicklistOrText,
  RadioButtons,
  Text,
} from '~/components/form-fields';
import {
  createDatesValidationHandler,
  createMultilineTextValidationHandler,
  createNumbersInputValidationHandler,
  createPasswordValidationHandler,
  createPreSubmitCheckboxesValidationHandler,
  createPreSubmitPicklistValidationHandler,
  createRadioButtonsValidationHandler,
  createTextInputValidationHandler,
  type FieldStateSetFn,
} from '~/components/form-fields/shared/field-handlers';
import { Link } from '~/components/link';
import { Button } from '~/components/ui/button';
import { Form, FormSubmit } from '~/components/ui/form';
import { useRouter } from '~/i18n/routing';

import { Modal } from '../../../../_components/modal';
import { deleteAddress } from '../../../_actions/delete-address';
import { updateAddress } from '../_actions/update-address';
import { CustomerEditAddressQueryResult } from '../page';

type Address = NonNullable<
  NonNullable<CustomerEditAddressQueryResult['customer']>['addresses']['edges']
>[number]['node'];

type AddressFields = NonNullable<
  CustomerEditAddressQueryResult['site']['settings']
>['formFields']['shippingAddress'];

type Countries = NonNullable<CustomerEditAddressQueryResult['geography']['countries']>;
type CountryStates = Countries[number]['statesOrProvinces'];

type FieldUnionType = Exclude<
  keyof typeof FieldNameToFieldId,
  'email' | 'password' | 'confirmPassword' | 'exclusiveOffers' | 'currentPassword'
>;

const createCountryChangeHandler =
  (provinceSetter: FieldStateSetFn<CountryStates>, countries: Countries) => (value: string) => {
    const states = countries.find(({ code }) => code === value)?.statesOrProvinces;

    provinceSetter(states ?? []);
  };

const isExistedField = (name: unknown): name is FieldUnionType => {
  if (typeof name === 'string' && name in FieldNameToFieldId) {
    return true;
  }

  return false;
};

interface SumbitMessages {
  messages: {
    submit: string;
    submitting: string;
  };
}

const SubmitButton = ({ messages }: SumbitMessages) => {
  const { pending } = useFormStatus();

  return (
    <Button
      className="relative items-center px-8 py-2 md:w-fit"
      loading={pending}
      loadingText={messages.submitting}
      variant="primary"
    >
      {messages.submit}
    </Button>
  );
};

interface EditAddressProps {
  address: Address;
  addressFields: AddressFields;
  countries: Countries;
  isAddressRemovable: boolean;
}

export const EditAddressForm = ({
  address,
  addressFields,
  countries,
  isAddressRemovable,
}: EditAddressProps) => {
  const form = useRef<HTMLFormElement>(null);
  const t = useTranslations('Account.Addresses.Edit.Form');

  const router = useRouter();

  const [textInputValid, setTextInputValid] = useState<Record<string, boolean>>({});
  const [passwordValid, setPasswordValid] = useState<Record<string, boolean>>({});
  const [numbersInputValid, setNumbersInputValid] = useState<Record<string, boolean>>({});
  const [datesValid, setDatesValid] = useState<Record<string, boolean>>({});
  const [radioButtonsValid, setRadioButtonsValid] = useState<Record<string, boolean>>({});
  const [picklistValid, setPicklistValid] = useState<Record<string, boolean>>({});
  const [checkboxesValid, setCheckboxesValid] = useState<Record<string, boolean>>({});
  const [multiTextValid, setMultiTextValid] = useState<Record<string, boolean>>({});

  const defaultStates = countries
    .filter((country) => country.code === address.countryCode)
    .flatMap((country) => country.statesOrProvinces);
  const [countryStates, setCountryStates] = useState<CountryStates>(defaultStates);

  const handleTextInputValidation = createTextInputValidationHandler(
    setTextInputValid,
    textInputValid,
  );
  const handlePasswordValidation = createPasswordValidationHandler(setPasswordValid, addressFields);
  const handleNumbersInputValidation = createNumbersInputValidationHandler(
    setNumbersInputValid,
    numbersInputValid,
  );
  const handleCountryChange = createCountryChangeHandler(setCountryStates, countries);
  const handleDatesValidation = createDatesValidationHandler(setDatesValid, datesValid);
  const handleRadioButtonsChange = createRadioButtonsValidationHandler(
    setRadioButtonsValid,
    radioButtonsValid,
  );
  const handleMultiTextValidation = createMultilineTextValidationHandler(
    setMultiTextValid,
    multiTextValid,
  );

  const validatePicklistFields = createPreSubmitPicklistValidationHandler(
    addressFields,
    setPicklistValid,
  );

  const validateCheckboxFields = createPreSubmitCheckboxesValidationHandler(
    addressFields,
    setCheckboxesValid,
  );

  const preSubmitFieldsValidation = (
    e: MouseEvent<HTMLFormElement> & { target: HTMLButtonElement },
  ) => {
    if (e.target.nodeName === 'BUTTON' && e.target.type === 'submit') {
      validatePicklistFields(form.current);
      validateCheckboxFields(form.current);
    }
  };

  const onSubmit = async (formData: FormData) => {
    const { status, message } = await updateAddress(formData, address.entityId);

    if (status === 'error') {
      toast.error(message, {
        icon: <AlertCircle className="text-error-secondary" />,
      });

      return;
    }

    toast.success(message, {
      icon: <Check className="text-success-secondary" />,
    });

    router.push('/account/addresses', { scroll: true });
  };

  const onDeleteAddress = async () => {
    const { status, message } = await deleteAddress(address.entityId);

    if (status === 'error') {
      toast.error(message, {
        icon: <AlertCircle className="text-error-secondary" />,
      });

      return;
    }

    toast.success(message, {
      icon: <Check className="text-success-secondary" />,
    });

    router.push('/account/addresses', { scroll: true });
  };

  return (
    <Form action={onSubmit} onClick={preSubmitFieldsValidation} ref={form}>
      <div className="grid grid-cols-1 gap-y-3 lg:grid-cols-2 lg:gap-x-6">
        {addressFields.map((field) => {
          const fieldId = field.entityId;
          const fieldName = createFieldName(field, 'address');
          const key = FieldNameToFieldId[fieldId];
          const defaultCustomField = address.formFields.find(
            ({ entityId }) => entityId === fieldId,
          );
          const defaultValue = (isExistedField(key) && address[key]) || undefined;

          switch (field.__typename) {
            case 'TextFormField': {
              const previousTextValue =
                getPreviouslySubmittedValue(defaultCustomField).TextFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <Text
                    defaultValue={defaultValue ?? previousTextValue}
                    field={field}
                    isValid={textInputValid[fieldId]}
                    name={fieldName}
                    onChange={handleTextInputValidation}
                  />
                </FieldWrapper>
              );
            }

            case 'MultilineTextFormField': {
              const previousMultiTextValue =
                getPreviouslySubmittedValue(defaultCustomField).MultilineTextFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <MultilineText
                    defaultValue={previousMultiTextValue}
                    field={field}
                    isValid={multiTextValid[fieldId]}
                    name={fieldName}
                    onChange={handleMultiTextValidation}
                  />
                </FieldWrapper>
              );
            }

            case 'NumberFormField': {
              const previousNumberValue =
                getPreviouslySubmittedValue(defaultCustomField).NumberFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <NumbersOnly
                    defaultValue={previousNumberValue}
                    field={field}
                    isValid={numbersInputValid[fieldId]}
                    name={fieldName}
                    onChange={handleNumbersInputValidation}
                  />
                </FieldWrapper>
              );
            }

            case 'CheckboxesFormField': {
              const previousCheckboxesValue =
                getPreviouslySubmittedValue(defaultCustomField).CheckboxesFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <Checkboxes
                    defaultValue={previousCheckboxesValue}
                    field={field}
                    isValid={checkboxesValid[fieldId]}
                    name={fieldName}
                    onValidate={setCheckboxesValid}
                    options={field.options}
                  />
                </FieldWrapper>
              );
            }

            case 'DateFormField': {
              const previousDateValue =
                getPreviouslySubmittedValue(defaultCustomField).DateFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <DateField
                    defaultValue={previousDateValue}
                    field={field}
                    isValid={datesValid[fieldId]}
                    name={fieldName}
                    onChange={handleDatesValidation}
                    onValidate={setDatesValid}
                  />
                </FieldWrapper>
              );
            }

            case 'RadioButtonsFormField': {
              const previousMultipleChoiceValue =
                getPreviouslySubmittedValue(defaultCustomField).MultipleChoiceFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <RadioButtons
                    defaultValue={previousMultipleChoiceValue}
                    field={field}
                    isValid={radioButtonsValid[fieldId]}
                    name={fieldName}
                    onChange={handleRadioButtonsChange}
                  />
                </FieldWrapper>
              );
            }

            case 'PicklistFormField': {
              const isCountrySelector = fieldId === FieldNameToFieldId.countryCode;
              const previousMultipleChoiceValue =
                getPreviouslySubmittedValue(defaultCustomField).MultipleChoiceFormField;
              const picklistOptions = isCountrySelector
                ? countries.map(({ name, code }) => ({ label: name, entityId: code }))
                : field.options;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <Picklist
                    defaultValue={isCountrySelector ? defaultValue : previousMultipleChoiceValue}
                    field={field}
                    isValid={picklistValid[fieldId]}
                    name={fieldName}
                    onChange={isCountrySelector ? handleCountryChange : undefined}
                    onValidate={setPicklistValid}
                    options={picklistOptions}
                  />
                </FieldWrapper>
              );
            }

            case 'PicklistOrTextFormField': {
              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <PicklistOrText
                    defaultValue={
                      fieldId === FieldNameToFieldId.stateOrProvince ? defaultValue : undefined
                    }
                    field={field}
                    key={countryStates.length}
                    name={fieldName}
                    options={countryStates.map(({ name }) => ({ entityId: name, label: name }))}
                  />
                </FieldWrapper>
              );
            }

            case 'PasswordFormField': {
              const previousPasswordValue =
                getPreviouslySubmittedValue(defaultCustomField).PasswordFormField;

              return (
                <FieldWrapper fieldId={fieldId} key={fieldId}>
                  <Password
                    defaultValue={previousPasswordValue}
                    field={field}
                    isValid={passwordValid[fieldId]}
                    name={fieldName}
                    onChange={handlePasswordValidation}
                  />
                </FieldWrapper>
              );
            }

            default:
              return null;
          }
        })}
      </div>

      <div className="mt-8 flex flex-col justify-stretch gap-2 md:flex-row md:justify-between md:gap-0">
        <FormSubmit asChild>
          <SubmitButton messages={{ submit: t('submit'), submitting: t('submitting') }} />
        </FormSubmit>
        <Button asChild className="items-center px-8 md:ms-6 md:w-fit" variant="secondary">
          <Link href="/account/addresses">{t('cancel')}</Link>
        </Button>
        <Modal
          actionHandler={onDeleteAddress}
          confirmationText={t('confirmDeleteAddress')}
          title={t('deleteModalTitle')}
        >
          <Button
            className="ms-auto items-center px-8 md:w-fit"
            disabled={!isAddressRemovable}
            variant="subtle"
          >
            {t('deleteButton')}
          </Button>
        </Modal>
      </div>
    </Form>
  );
};
