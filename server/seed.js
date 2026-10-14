const db = require('./db');

function seed() {
  console.log('Seeding office attendance database...');

  // Clear existing data for clean re-seed if needed
  db.prepare('DELETE FROM leave_requests').run();
  db.prepare('DELETE FROM attendance').run();
  db.prepare('DELETE FROM employees').run();

  const insertEmployee = db.prepare(`
    INSERT INTO employees (emp_id, name, email, phone, department, role, pin, avatar, status, join_date)
    VALUES (@emp_id, @name, @email, @phone, @department, @role, @pin, @avatar, @status, @join_date)
  `);

  const employees = [
    {
      emp_id: 'EMP-101',
      name: 'Alex Rivera',
      email: 'alex.rivera@company.com',
      phone: '+1 555-0192',
      department: 'Engineering',
      role: 'Lead Architect',
      pin: '1001',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2023-01-15'
    },
    {
      emp_id: 'EMP-102',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      phone: '+1 555-0144',
      department: 'Product',
      role: 'Product Manager',
      pin: '1002',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2023-03-10'
    },
    {
      emp_id: 'EMP-103',
      name: 'David Miller',
      email: 'david.miller@company.com',
      phone: '+1 555-0177',
      department: 'Engineering',
      role: 'Senior Fullstack Dev',
      pin: '1003',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2023-06-01'
    },
    {
      emp_id: 'EMP-104',
      name: 'Priya Sharma',
      email: 'priya.sharma@company.com',
      phone: '+1 555-0188',
      department: 'Human Resources',
      role: 'HR Specialist',
      pin: '1004',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2022-11-20'
    },
    {
      emp_id: 'EMP-105',
      name: 'Michael Torres',
      email: 'michael.torres@company.com',
      phone: '+1 555-0122',
      department: 'Sales & Marketing',
      role: 'Account Executive',
      pin: '1005',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2024-02-01'
    },
    {
      emp_id: 'EMP-106',
      name: 'Emily Watson',
      email: 'emily.watson@company.com',
      phone: '+1 555-0155',
      department: 'Design',
      role: 'UI/UX Designer',
      pin: '1006',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2024-04-12'
    },
    {
      emp_id: 'EMP-107',
      name: 'James Wilson',
      email: 'james.wilson@company.com',
      phone: '+1 555-0119',
      department: 'Operations',
      role: 'Office Coordinator',
      pin: '1007',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2023-08-05'
    },
    {
      emp_id: 'EMP-108',
      name: 'Amina Al-Mansoor',
      email: 'amina.almansoor@company.com',
      phone: '+1 555-0163',
      department: 'Finance',
      role: 'Financial Analyst',
      pin: '1008',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      join_date: '2023-09-18'
    }
  ];

  for (const emp of employees) {
    insertEmployee.run(emp);
  }

  // Generate historical attendance for the last 7 working days
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (emp_id, date, clock_in, clock_out, total_hours, status, method, notes)
    VALUES (@emp_id, @date, @clock_in, @clock_out, @total_hours, @status, @method, @notes)
  `);

  const today = new Date();
  
  for (let i = 6; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Skip Sundays
    if (d.getDay() === 0) continue;

    const dateStr = d.toISOString().split('T')[0];

    employees.forEach((emp, idx) => {
      // Rotate statuses realistically
      let clockIn = '08:52:10';
      let clockOut = '18:05:42';
      let status = 'present';
      let hours = 9.2;

      if ((idx + i) % 7 === 0) {
        // Late arrival
        clockIn = '09:35:15';
        clockOut = '18:15:00';
        status = 'late';
        hours = 8.6;
      } else if ((idx + i) % 11 === 0) {
        // Half day
        clockIn = '08:58:00';
        clockOut = '13:10:00';
        status = 'half_day';
        hours = 4.2;
      }

      insertAttendance.run({
        emp_id: emp.emp_id,
        date: dateStr,
        clock_in: clockIn,
        clock_out: clockOut,
        total_hours: hours,
        status: status,
        method: 'facelock',
        notes: status === 'late' ? 'Traffic delay' : null
      });
    });
  }

  // Today's attendance (some clocked in, some late, some haven't clocked in yet)
  const todayStr = today.toISOString().split('T')[0];
  const todayRecords = [
    { emp_id: 'EMP-101', clock_in: '08:48:22', clock_out: null, status: 'present', method: 'facelock' },
    { emp_id: 'EMP-102', clock_in: '09:02:11', clock_out: null, status: 'present', method: 'facelock' },
    { emp_id: 'EMP-103', clock_in: '09:28:45', clock_out: null, status: 'late', method: 'facelock' },
    { emp_id: 'EMP-104', clock_in: '08:55:00', clock_out: null, status: 'present', method: 'facelock' },
    { emp_id: 'EMP-106', clock_in: '09:05:30', clock_out: null, status: 'present', method: 'facelock' },
    { emp_id: 'EMP-107', clock_in: '08:35:10', clock_out: '12:45:00', total_hours: 4.1, status: 'half_day', method: 'pin' }
  ];

  for (const rec of todayRecords) {
    insertAttendance.run({
      emp_id: rec.emp_id,
      date: todayStr,
      clock_in: rec.clock_in,
      clock_out: rec.clock_out || null,
      total_hours: rec.total_hours || 0,
      status: rec.status,
      method: rec.method,
      notes: null
    });
  }

  // Seed sample leave requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (emp_id, type, start_date, end_date, days, reason, status, admin_notes)
    VALUES (@emp_id, @type, @start_date, @end_date, @days, @reason, @status, @admin_notes)
  `);

  insertLeave.run({
    emp_id: 'EMP-105',
    type: 'casual',
    start_date: todayStr,
    end_date: todayStr,
    days: 1,
    reason: 'Family appointment and personal errands',
    status: 'approved',
    admin_notes: 'Approved by HR'
  });

  insertLeave.run({
    emp_id: 'EMP-108',
    type: 'sick',
    start_date: todayStr,
    end_date: todayStr,
    days: 1,
    reason: 'Mild fever and doctor consultation',
    status: 'pending',
    admin_notes: null
  });

  insertLeave.run({
    emp_id: 'EMP-103',
    type: 'annual',
    start_date: '2026-10-20',
    end_date: '2026-10-24',
    days: 5,
    reason: 'Annual family vacation',
    status: 'pending',
    admin_notes: null
  });

  console.log(`Database seeded with ${employees.length} employees, attendance history, and leave requests.`);
}

seed();
