insert into technology (code, name)
values ('data_center', 'Data center')
on conflict (code) do update set name = excluded.name;

