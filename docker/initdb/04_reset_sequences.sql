DO $$
DECLARE
    rec RECORD;
    t TEXT;
    c TEXT;
    seqname TEXT;
    seq_ident TEXT;
BEGIN
    -- Add Roles, Permissions, RolePermissions, Groups, Users, and SystemSettings to this list
    FOR rec IN SELECT * FROM (VALUES
        ('Roles','id'),
        ('Permissions','id'),
        ('RolePermissions','id'),
        ('Groups','id'),
        ('Users','id'),
        ('Goals','id'),
        ('Tasks','id'),
        ('Activities','id'),
        ('Goals','rollNo'),
        ('Tasks','rollNo'),
        ('Activities','rollNo')
    ) AS v(table_name, col_name)
    LOOP
        t := rec.table_name;
        c := rec.col_name;
        
        -- Get existing sequence
        seqname := pg_get_serial_sequence(format('public."%s"', t), c);
        
        IF seqname IS NOT NULL THEN
            -- Reset sequence to MAX(id)
            EXECUTE format(
                'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM public."%s"), 1))',
                seqname, c, t
            );
            RAISE NOTICE 'Reset existing sequence % for table %.', seqname, t;
        ELSE
            -- (Your existing logic for creating missing sequences handles the rest)
            -- ...
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;