import { render, screen } from '@testing-library/react';
import React from 'react';

describe('sanity', () => {
  it('renders a simple element', () => {
    render(React.createElement('div', null, 'hello'));
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
