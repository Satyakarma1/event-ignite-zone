-- Correct the existing owner profile's public-safe organizer fields.
update public.profiles
set full_name = 'Pratham Gupta',
    reg_number = '25BAI0165',
    programme = '2nd year',
    instagram = 'https://www.instagram.com/prathamgupta581/',
    linkedin = 'https://www.linkedin.com/in/pratham-gupta-180b0a315/',
    updated_at = now()
where id = (select user_id from public.site_owner where id = true);
