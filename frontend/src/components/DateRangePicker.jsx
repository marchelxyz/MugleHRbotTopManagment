// frontend/src/components/DateRangePicker.jsx

import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DateRangePicker.css';

const DateRangePicker = ({ startDate, setStartDate, endDate, setEndDate }) => {
  return (
    <div className="date-picker-container">
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        selectsStart
        startDate={startDate}
        endDate={endDate}
        placeholderText="Начало периода"
        className="date-input"
        dateFormat="dd.MM.yyyy"
        locale="ru" // <-- ДОБАВЛЕНО
      />
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        selectsEnd
        startDate={startDate}
        endDate={endDate}
        minDate={startDate}
        placeholderText="Конец периода"
        className="date-input"
        dateFormat="dd.MM.yyyy"
        locale="ru" // <-- ДОБАВЛЕНО
      />
    </div>
  );
};

export default DateRangePicker;
