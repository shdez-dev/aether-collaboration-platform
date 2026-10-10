import { fireEvent, render, screen } from '@testing-library/react';
import { PresenceAvatar, PresencePicker } from './presence';

describe('estado de presencia', () => {
  it('muestra el indicador junto al avatar y permite cambiar entre cuatro estados', () => {
    const onChange = jest.fn();
    render(<PresencePicker name="Ana" status="ONLINE" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar estado: En línea' }));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'No molestar' }));
    expect(onChange).toHaveBeenCalledWith('DND');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('etiqueta la presencia desconectada en el avatar', () => {
    render(<PresenceAvatar name="Ana" status="OFFLINE" />);
    expect(screen.getByLabelText('Desconectada')).toBeTruthy();
  });
});
