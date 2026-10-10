import { fireEvent, render, screen, within } from '@testing-library/react';
import { ClockTimePicker } from './DateTimePickers';

it('hides earlier end hours and minutes when the event ends on its start day', () => {
  const onChange = jest.fn();
  render(<ClockTimePicker label="Fin" value="17:00" minTime="16:30" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fin: 17:00' }));
  const hours = within(screen.getByRole('group', { name: 'Horas' }));
  expect(hours.queryByRole('button', { name: '15' })).not.toBeInTheDocument();
  fireEvent.click(hours.getByRole('button', { name: '16' }));
  expect(onChange).toHaveBeenCalledWith('16:31');
});
