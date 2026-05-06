begin;

alter table if exists user_account_restrictions
  alter column message set default 'Your account is temporarily restricted for security reasons. Please contact support@maxvideoai.com.';

update user_account_restrictions
set message = 'Your account is temporarily restricted for security reasons. Please contact support@maxvideoai.com.'
where message = 'Your account is temporarily restricted for security reasons. Please contact support.';

commit;
